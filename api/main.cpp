#include <opencv2/opencv.hpp>
#include <iostream>
#include <set>

int main(int argc, char** argv)
{
    std::cout << "Program started." << std::endl;

    if (argc < 2) {
        std::cout << "Usage: imagedemo/f0270869-800px-wm.jpg" << std::endl;
        return -1;
    }

    std::cout << "Reading image: " << argv[1] << std::endl;
    cv::Mat img = cv::imread(argv[1]);
    if (img.empty()) {
        std::cout << "Cannot read image!" << std::endl;
        return -1;
    }
    std::cout << "Image loaded successfully." << std::endl;

    cv::Mat gray, blurImg, thresh;
    cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
    cv::GaussianBlur(gray, blurImg, cv::Size(5,5), 0);

    std::cout << "Applying threshold..." << std::endl;
    cv::threshold(blurImg, thresh, 200, 255, cv::THRESH_BINARY);

    cv::Mat kernel = cv::getStructuringElement(cv::MORPH_ELLIPSE, cv::Size(3,3));
    cv::morphologyEx(thresh, thresh, cv::MORPH_OPEN, kernel, cv::Point(-1,-1), 2);

    std::cout << "Running distance transform..." << std::endl;
    cv::Mat dist;
    cv::distanceTransform(thresh, dist, cv::DIST_L2, 5);
    cv::normalize(dist, dist, 0, 1.0, cv::NORM_MINMAX);

    cv::Mat distThresh;
    cv::threshold(dist, distThresh, 0.4, 1.0, cv::THRESH_BINARY);
    distThresh.convertTo(distThresh, CV_8U);

    std::cout << "Finding connected components..." << std::endl;
    cv::Mat markers;
    int nLabels = cv::connectedComponents(distThresh, markers);

    cv::Mat imgCopy;
    if (img.channels() == 3) {
        imgCopy = img.clone();
    } else {
        cv::cvtColor(img, imgCopy, cv::COLOR_GRAY2BGR);
    }
    std::cout << "Running watershed..." << std::endl;
    cv::watershed(imgCopy, markers);

    std::set<int> labels;
    std::map<int, cv::Point> sumPoints;
    std::map<int, int> countPoints;

    cv::Mat result = img.clone();
    for (int y = 0; y < markers.rows; y++) {
        for (int x = 0; x < markers.cols; x++) {
            int v = markers.at<int>(y, x);
            if (v > 1) {
                labels.insert(v);
                result.at<cv::Vec3b>(y, x) = cv::Vec3b(0, 0, 255);
                sumPoints[v] += cv::Point(x, y);
                countPoints[v]++;
            }
        }
    }

    std::cout << "So vet dan phat hien: " << labels.size() << std::endl;

    for (auto &c : sumPoints) {
        int v = c.first;
        if (countPoints[v] > 0) {
            cv::Point center(c.second.x / countPoints[v], c.second.y / countPoints[v]);
            cv::circle(result, center, 5, cv::Scalar(0, 255, 0), -1);
        }
    }

    std::cout << "Displaying results..." << std::endl;
    cv::imshow("Original", img);
    cv::imshow("Threshold", thresh);
    cv::imshow("Distance", dist);
    cv::imshow("Result", result);
    cv::waitKey(0);

    std::cout << "Program finished." << std::endl;
    return 0;
}