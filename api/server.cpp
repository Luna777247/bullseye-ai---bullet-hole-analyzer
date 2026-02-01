#include <opencv2/opencv.hpp>
#include <crow_all.h>
#include <iostream>
#include <set>
#include <map>


// Tính ngưỡng diện tích động dựa trên kích thước ảnh
struct AreaThresholds {
    int minArea;
    int maxArea;
};

AreaThresholds calculateAreaThresholds(int imageWidth, int imageHeight) {
    // Tính diện tích toàn bộ ảnh
    double totalArea = imageWidth * imageHeight;
    
    // Tỷ lệ min/max của diện tích lỗ đạn so với diện tích ảnh
    // Min: 0.05% của ảnh (lỗ đạn nhỏ nhất)
    // Max: 1% của ảnh (lỗ đạn lớn nhất)
    // Các tỷ lệ này có thể điều chỉnh tùy theo yêu cầu thực tế
    
    AreaThresholds thresholds;
    thresholds.minArea = std::max(50, (int)(totalArea * 0.0005));      // Tối thiểu 50 pixel
    thresholds.maxArea = std::min(50000, (int)(totalArea * 0.01));     // Tối đa 1% diện tích ảnh
    
    return thresholds;
}

// Hàm xử lý ảnh và trả về số vết đạn cùng toạ độ
crow::json::wvalue detect_bullet_holes(const cv::Mat& img) {
    crow::json::wvalue result_json;

    // Tính ngưỡng diện tích động dựa trên kích thước ảnh
    AreaThresholds areaThresholds = calculateAreaThresholds(img.cols, img.rows);

    // 1. Grayscale
    cv::Mat gray;
    cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);

    // 2. Threshold (tìm vùng SÁNG = lỗ đạn)
    cv::Mat bw;
    cv::threshold(gray, bw, 200, 255, cv::THRESH_BINARY);

    // 3. Morphology - kernel nhỏ hơn để giữ khoảng cách giữa các lỗ
    cv::Mat kernel = cv::getStructuringElement(cv::MORPH_ELLIPSE, cv::Size(3,3));
    cv::morphologyEx(bw, bw, cv::MORPH_OPEN, kernel, cv::Point(-1,-1), 1);
    cv::morphologyEx(bw, bw, cv::MORPH_CLOSE, kernel, cv::Point(-1,-1), 1);

    // 4. Distance Transform
    cv::Mat dist;
    cv::distanceTransform(bw, dist, cv::DIST_L2, 5);
    cv::normalize(dist, dist, 0, 1.0, cv::NORM_MINMAX);

    // 5. Tìm local maxima để làm seed cho watershed
    cv::Mat sure_fg;
    cv::threshold(dist, sure_fg, 0.3, 1.0, cv::THRESH_BINARY);
    sure_fg.convertTo(sure_fg, CV_8U, 255);
    
    // Tìm local peaks mạnh hơn bằng cách dùng dilate
    cv::Mat local_max;
    cv::Mat kernel_peak = cv::getStructuringElement(cv::MORPH_ELLIPSE, cv::Size(7,7));
    cv::dilate(dist, local_max, kernel_peak);
    cv::Mat peaks = (dist == local_max) & (dist > 0.2);  // Chỉ lấy peaks đủ mạnh
    peaks.convertTo(peaks, CV_8U, 255);
    
    // Kết hợp với sure_fg để có markers tốt hơn
    cv::bitwise_and(sure_fg, peaks, sure_fg);

    // 6. Sure background - dilate ít hơn để giữ ranh giới rõ ràng
    cv::Mat sure_bg;
    cv::dilate(bw, sure_bg, kernel, cv::Point(-1,-1), 1);

    // 7. Unknown
    cv::Mat unknown;
    cv::subtract(sure_bg, sure_fg, unknown);

    // 8. Marker
    cv::Mat markers;
    cv::connectedComponents(sure_fg, markers);
    markers += 1;
    markers.setTo(0, unknown == 255);

    // 9. Watershed
    cv::watershed(img, markers);

    // 10. Tính tâm + bán kính
    double minVal, maxVal;
    cv::minMaxLoc(markers, &minVal, &maxVal);
    int maxLabel = (int)maxVal;

    std::vector<crow::json::wvalue> coords;

    for (int label = 2; label <= maxLabel; label++) {
        cv::Mat mask = (markers == label);
        int area = cv::countNonZero(mask);

        // Lọc nhiễu, cho phép lỗ nhỏ sau khi tách
        if (area < 50) continue;

        // Tính centroid
        cv::Moments m = cv::moments(mask, true);
        if (m.m00 == 0) continue;

        double cx = m.m10 / m.m00;
        double cy = m.m01 / m.m00;

        // Bán kính tương đương
        double radius = std::sqrt(area / CV_PI);

        crow::json::wvalue pt;
        pt["x"] = cx;
        pt["y"] = cy;
        pt["radius"] = radius;

        coords.push_back(std::move(pt));
    }

    // 11. Xuất JSON
    result_json["count"] = (int)coords.size();
    result_json["coordinates"] = std::move(coords);
    
    // Thêm thông tin debug về kích thước ảnh và ngưỡng diện tích
    result_json["imageWidth"] = img.cols;
    result_json["imageHeight"] = img.rows;
    result_json["areaThresholds"]["min"] = areaThresholds.minArea;
    result_json["areaThresholds"]["max"] = areaThresholds.maxArea;

    return result_json;
}

int main() {
    crow::SimpleApp app;
    
    // Health check endpoint
    CROW_ROUTE(app, "/health").methods("GET"_method)
    ([]() {
        crow::response res;
        res.add_header("Access-Control-Allow-Origin", "*");
        res.code = 200;
        res.body = "ok";
        return res;
    });
    
    // Route /detect - xử lý cả POST và OPTIONS
    CROW_ROUTE(app, "/detect").methods("POST"_method, "OPTIONS"_method)
    ([](const crow::request& req) {
        crow::response res;
        
        // Luôn thêm CORS headers
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type");
        
        // Debug: in ra method
        std::cerr << "Method: " << (int)req.method << " (0=DELETE, 1=GET, 2=HEAD, 3=POST, 4=PUT, 5=CONNECT, 6=OPTIONS, 7=TRACE)" << std::endl;
        
        // Xử lý OPTIONS preflight
        if (req.method == crow::HTTPMethod::Options) {
            res.code = 204;
            std::cerr << "Returning OPTIONS 204" << std::endl;
            return res;
        }
        
        // Xử lý POST request
        if (req.method == crow::HTTPMethod::Post) {
            std::cerr << "Processing POST request, body size: " << req.body.size() << std::endl;
            const std::string& body = req.body;
            std::vector<uchar> data(body.begin(), body.end());
            cv::Mat img = cv::imdecode(data, cv::IMREAD_COLOR);

            if (img.empty()) {
                crow::json::wvalue err;
                err["error"] = "Cannot read image!";
                res.code = 400;
                res.body = err.dump();
                return res;
            }

            auto result_json = detect_bullet_holes(img);
            res.code = 200;
            res.body = result_json.dump();
            return res;
        }
        
        // Method not allowed
        std::cerr << "Method not allowed" << std::endl;
        res.code = 405;
        res.body = "Method Not Allowed";
        return res;
    });
    
    // Chạy server trên port 8080, cho phép xử lý đa luồng
    app.port(8080).multithreaded().run();
    return 0;
}
