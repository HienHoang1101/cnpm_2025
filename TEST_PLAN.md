**Kế hoạch kiểm thử & Giám sát (FastFood_Delivery)**

Mục đích: Tài liệu này mô tả bộ test unit, integration và các test liên quan tới monitoring/alert cho đồ án FastFood_Delivery. Giáo viên lưu ý: "MONITOR LÀ PHẦN QUAN TRỌNG" — do đó bổ sung nhiều test liên quan tới metrics/health/alerts.

Phiên bản: 1.0
Thời gian hoàn thành nhanh: Tối ưu để nộp trong 20 phút (tài liệu & bộ test case). Thực thi test thực tế yêu cầu cài đặt dịch vụ và môi trường (Docker / docker-compose / Kubernetes).

---

**Tổng quan**
- **Phạm vi:** services chính: `auth`, `food-delivery-server` (order), `payment-service`, `restaurant`, `notification-service`, `admin-service`. Ngoài ra client/frontend chạy smoke tests.
- **Loại test:** Unit test (mỗi service), Integration test (ghi nhận luồng đặt hàng toàn hệ thống), Monitoring tests (metrics + health + alert rules), Regression/End-to-end (chạy nhanh khi cần).

**Nguyên tắc chung**
- Mỗi service phải có: một thư mục `tests/` chứa unit tests và integration tests liên quan tới DB/Redis nếu cần.
- Unit tests: mock external dependencies (DB, Kafka, third-party services).
- Integration tests: dựng môi trường phụ trợ (local DB, kafka hoặc mock broker), hoặc dùng docker-compose để chạy stack nhẹ.
- Monitoring: service phải expose `/metrics` (Prometheus) và `/health` (liveness/readiness).

---

**1. Unit Tests — cấu trúc & ví dụ test case**
- Mục tiêu: kiểm tra logic đơn vị, validate edge cases, input validation, error handling.
- Nguyên tắc: nhanh (<100ms/test), không truy cập mạng/DB thật.

Ví dụ test case cho `payment-service` (file: `payment-service/tests/unit/test_payment.py`):
- TC-UNIT-PAY-01: `processPayment` với payload hợp lệ -> trả về status `paid` và transaction id.
  - Setup: mock gateway (stub success)
  - Steps: gọi hàm xử lý
  - Kết quả mong đợi: trả về object có `status: 'success'`, `txId` non-empty

- TC-UNIT-PAY-02: `processPayment` với hạn mức vượt quá -> trả về lỗi `InsufficientFunds` hoặc `limit_exceeded`
  - Setup: mock gateway trả lỗi
  - Kết quả: exception hoặc object lỗi đúng type

- TC-UNIT-PAY-03: Input validation: thiếu `amount` -> trả lỗi 400

Ví dụ test case cho `auth` service:
- TC-UNIT-AUTH-01: `login` với mật khẩu chính xác -> trả token JWT hợp lệ
- TC-UNIT-AUTH-02: `login` với user không tồn tại -> trả 401
- TC-UNIT-AUTH-03: `register` với email đã tồn tại -> trả 409

Ví dụ test case cho `order` logic (`food-delivery-server`):
- TC-UNIT-ORDER-01: Tạo order hợp lệ -> trả orderId và trạng thái `pending`
- TC-UNIT-ORDER-02: Tính phí giao: multiple items, discount áp dụng -> kiểm tra tổng tiền

Checklist Unit Tests (per service):
- Input validation (missing/invalid fields)
- Happy path
- Error paths (DB error, external API error)
- Boundary values (amount=0, negative, very large)

---

**2. Integration Tests — mô tả chung & test case mẫu**
- Mục tiêu: xác thực luồng giữa 2+ services, ví dụ: đặt hàng -> thanh toán -> thông báo.
- Thực thi: dùng docker-compose (local) hoặc mock các service; tốt nhất là dùng `docker-compose.test.yml` chứa: mongo, redis, kafka (nếu cần), test instances.

Luồng chính (end-to-end tích hợp):
- TC-INTEG-01: Đặt món thành công (E2E)
  - Steps:
    1. Tạo user (call `auth`) hoặc dùng fixture
    2. Tạo order (call `food-delivery-server`)
    3. Mock/Call `payment-service` để thanh toán
    4. Kiểm tra `order` đổi trạng thái thành `paid` và `notification-service` nhận event
  - Expect: order.status == `confirmed` (hoặc `paid`), notification queued/sent

- TC-INTEG-02: Thanh toán thất bại -> rollback order
  - Steps: Tạo order, mock payment fail
  - Expect: order.status == `payment_failed` và hệ thống gửi alert/log tương ứng

- TC-INTEG-03: Quản lý tồn kho/restaurant: đặt món khi món hết -> trả lỗi `out_of_stock` và không charge

- TC-INTEG-04: Consumer/Producer Kafka test: khi order tạo, event được publish; consumer `notification` xử lý và lưu message

Chi tiết setup integration tests:
- Dùng test DB, seed data, sau test clean-up DB
- Có thể dùng `pytest` + `requests` cho HTTP, hoặc `supertest` (node) tùy service stack

---

**3. Monitoring Tests & Test Cases (quan trọng theo yêu cầu giảng viên)**
Mục tiêu: đảm bảo service expose metrics/health, alert rules hoạt động, và metrics có ý nghĩa.

Yêu cầu cho mỗi service:
- Expose `/metrics` cho Prometheus (http client metrics, request latencies, error counters)
- Expose `/health` (liveness & readiness) trả JSON {status: "ok"}
- Export key metrics: `http_requests_total{service="<name>",status="5xx"}`, `http_request_duration_seconds_bucket`, `payments_processed_total`, `orders_created_total`, v.v.

Monitoring test cases (có thể tự động hoặc manual):
- TC-MON-01: Endpoint `/metrics` trả 200 và có metric `http_requests_total` với label `service`
  - Steps: curl /metrics, parse text, assert presence

- TC-MON-02: Giả lập lỗi 500 nhiều lần -> metric `http_requests_total{status="5xx"}` tăng >= threshold
  - Steps: gửi N request gây lỗi; scrape /metrics; assert counter tăng

- TC-MON-03: Health checks: `/health` trả 200 trong trạng thái bình thường; khi DB bị disconnect, readiness trả non-200

- TC-MON-04: Alert firing (integration with Prometheus+Alertmanager)
  - Steps: Trong Prometheus test environment, tạo rule: nếu `orders_created_total` giảm về 0 trong 5 phút -> fire alert
  - Test: Tắt producer để simulate drop, assert alert xuất hiện (test bằng Alertmanager API hoặc mock)

- TC-MON-05: Tracing presence: request path phải tạo trace/span (kiểm tra headers trace-id có propagate)

Automated monitoring checks (scripts):
- `scripts/check_metrics.sh` (hoặc powershell) thực hiện requests tới `/metrics` và báo lỗi nếu không có metrics quan trọng.

---

**4. CI/CD — chạy test & monitoring checks**
Recommendation: GitHub Actions workflow (`.github/workflows/ci.yml`) hoặc GitLab CI.

Steps trong pipeline:
1. Checkout
2. Setup Node.js (hoặc các runtime per service) / Install dependencies
3. Lint
4. Run unit tests in parallel (per service)
   - `npm --prefix payment-service test` etc.
5. Build docker images (optional)
6. Run integration tests using lightweight docker-compose (contains DB, required services)
7. Run monitoring checks (call `/metrics`, `/health`, run `scripts/check_metrics`)
8. On success, push artifacts (coverage reports), on fail, stop and notify

Example job snippet (pseudocode):
```
- name: Run unit tests
  run: |
    npm --prefix auth test --silent
    npm --prefix payment-service test --silent
```

Monitoring checks in CI:
- After integration stack up, run `curl http://payment-service:3000/metrics` and assert expected metrics exist.

---

**5. Test Cases (Bảng tóm tắt ngắn gọn, mã TC)**
- TC-UNIT-AUTH-01: Login success
- TC-UNIT-AUTH-02: Login fail (invalid creds)
- TC-UNIT-PAY-01: Payment success
- TC-UNIT-PAY-02: Payment fail (insufficient funds)
- TC-UNIT-ORDER-01: Create order success
- TC-INTEG-01: E2E place-order -> pay -> notify
- TC-INTEG-02: Payment fail -> order rollback
- TC-MON-01: /metrics present
- TC-MON-02: error counter increases on 500
- TC-MON-03: /health readiness toggles on downstream DB failure

Mỗi test case phải có: ID, Mục tiêu, Tiền điều kiện (fixtures), Các bước, Kết quả mong đợi, Cleanup.

---

**6. Cách thực thi nhanh (local)**
1. Chạy unit tests cho một service:
```
cd payment-service
npm install
npm test
```
2. Chạy integration stack (ví dụ docker-compose.test.yml):
```
docker-compose -f docker-compose.test.yml up --build -d
# rồi chạy test runner (pytest / jest) từ host
```
3. Chạy monitoring checks (powershell):
```
Invoke-RestMethod http://localhost:PORT/metrics | Select-String "http_requests_total"
Invoke-RestMethod http://localhost:PORT/health
```

---

**7. Gợi ý bổ sung và ưu tiên (để nộp nhanh)**
- Ưu tiên: Đảm bảo tất cả services có `/metrics` và `/health` (đây là yêu cầu của giảng viên)
- Bổ sung 5-10 unit tests cho các service quan trọng (`payment`, `order`, `auth`)
- Viết 2-3 integration tests E2E (thao tác đặt hàng + thanh toán + notification)
- Thêm script CI bước kiểm tra `/metrics` sau integration tests

**8. Checklist giao nộp (quick)**
- [ ] `TEST_PLAN.md` (hiện có)
- [ ] Unit tests: ít nhất 5 tests/critical service
- [ ] Integration tests: 2-3 tests E2E
- [ ] Monitoring tests: scripts kiểm tra `/metrics` và `/health`
- [ ] CI workflow: chạy unit + integration + monitoring checks

---

Nếu bạn muốn, tôi sẽ:
- (A) Tạo file workflow GitHub Actions mẫu `.github/workflows/ci.yml` để chạy unit + integration + monitoring checks, hoặc
- (B) Tạo các test skeleton (ví dụ `payment-service/tests/unit/test_payment.py`) với 3 test mẫu để bạn chạy ngay.

Chọn A hoặc B hoặc cả hai, tôi sẽ làm tiếp ngay.
