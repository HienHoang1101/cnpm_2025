Tóm tắt về phạm vi kiểm thử (unit & integration)
Unit tests (Kiểm thử đơn vị)

auth: endpoint health trả về 200; /metrics hiển thị các bộ đếm prom-client; các test cho controllers/middleware/user model xác thực luồng login/register và kiểm tra JWT; utils tests bao phủ các hàm helper. Mục đích: đảm bảo logic xác thực và các endpoint quan sát hoạt động xác định mà không phụ thuộc vào các dependency bên ngoài.
admin-service: health/ready phản hồi chính xác; /metrics trả về output prom-client; unit tests settlementController xử lý luồng thanh toán hàng tuần. Mục đích: xác minh các đường dẫn API admin và kết nối metrics mà không chạm đến cron/DB writes thực.
order: các endpoint health/ready; /metrics trả về output prom-client. Mục đích: xác nhận sự sẵn sàng cơ bản của service và hiển thị metrics.
payment-service: các endpoint health/ready; /metrics trả về output prom-client. Mục đích: bảo vệ cấu trúc API payment và khả năng quan sát mà không cần Stripe thực (client Stripe giờ được mock với dummy key trong môi trường test).
notification-service: endpoint health; /metrics trả về output prom-client. Mục đích: xác thực các phản hồi cơ bản của service và hệ thống metrics mà không cần Kafka.
restaurant: các endpoint health/ready; /metrics trả về output prom-client; cảnh báo cho Kafka producer được ghi log. Mục đích: đảm bảo khung service và metrics hoạt động ổn định trong chế độ test.
food-delivery-server (delivery): endpoint health; /metrics trả về output prom-client và http_requests_total tăng lên. Mục đích: xác minh delivery gateway hiển thị health/metrics như mong đợi ngay cả trong chế độ test.

Integration / smoke tests (Kiểm thử tích hợp / smoke)

observability/integration/run-integration-tests.js: với mỗi service (auth/order/restaurant/payment/notification/admin) gọi /health và /metrics; các kiểm tra chức năng tùy chọn cho login, tạo order, gửi notification; kiểm tra assertion metrics theo kịch bản thành công (happy-path) xác nhận http_requests_total tăng sau /health (strict chỉ khi metrics có mặt). Mục đích: kiểm tra tính khả dụng giữa các service với các endpoint nghiệp vụ tùy chọn.
observability/integration/start-mocks.js: các mock server nhẹ trên các cổng 5000/5001/5002/5003/5004/5007 phục vụ /health và /metrics. Được sử dụng để đáp ứng smoke tích hợp khi các service thực không chạy.
monitoring/tests/check-metrics.js: smoke thăm dò Prometheus/Grafana/Jaeger và các cổng service cho /health và /metrics, ghi log tính khả dụng. Mục đích: xác thực bề mặt giám sát.
monitoring/tests/prometheus-metrics-check.js: truy vấn Prometheus cho http_request_duration_seconds_count và các chuỗi khác để đảm bảo scrape thành công. Mục đích: xác minh việc thu thập dữ liệu của Prometheus.

CI workflows (Ý định artifact)

ci-cd.yml: ma trận test theo từng service (Node 18) chạy các bộ unit tests; job deploy build/push images nếu có registry secrets.
ci-fast.yml: smoke npm test nhanh cho từng service (không có coverage).
ci-auth.yml: ma trận dành riêng cho auth (Node 18) chạy test:ci và upload coverage.
observability-ci.yml: chạy unit tests cho mỗi service (expect test:ci để tạo coverage cộng junit), tải artifacts xuống, tóm tắt coverage, sau đó chạy smoke tích hợp (với INTEGRATION_STRICT true). Nếu thiếu thư mục coverage, bản tóm tắt bỏ qua các artifact không có.
monitoring-smoke.yml: khởi động monitoring stack, thử lại kiểm tra /metrics, và chạy các assertion Prometheus; upload logs/artifacts.