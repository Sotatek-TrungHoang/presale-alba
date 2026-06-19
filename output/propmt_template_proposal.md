# Template Spec: Vendor/Consultant Software Proposal (.docx)

## 1. Mục đích & cách dùng

Template proposal kỹ thuật + báo giá cho một dự án phát triển phần mềm (B2B SaaS) do vendor/consultant gửi khách hàng. File mẫu gốc là `Sotatek_Alba_Proposal_v1.0` (ví dụ điền sẵn cho sản phẩm "Shvely Platform"). Mọi giá trị cụ thể bên dưới là **placeholder ví dụ** — Claude Code phải thay bằng dữ liệu rút từ reports đầu vào.

Output: một file `.docx` (font **Times New Roman**, có thanh màu xanh lá ở header trang đầu, dùng Heading 1/2/3 để tạo document outline).

## 2. Cấu trúc tài liệu (theo thứ tự, đúng cấp heading)

**Trang bìa / header**
- Dòng nhỏ: tên vendor (vd "Vendor Consultant Company") + quốc gia (vd "Vietnam").
- Tiêu đề lớn (Title): tên sản phẩm/nền tảng (vd "Shvely Platform").
- Ngày tháng (vd "10th February 2026").

**`OVERVIEW` (Heading 1)**
Một đoạn văn (3–4 câu) mô tả sản phẩm là gì, dành cho ai, giải quyết vấn đề gì.
- Sub: **`Core Business Model` (Heading 3)** → bullet list các đặc điểm mô hình kinh doanh (dạng `<Tên đặc điểm>: <mô tả>`). Ví dụ: B2B SaaS Platform, Multi-Tenant Model, Data Enrichment & Analytics, Third-Party Integration Hub, Administrative Control.

**`ASSUMPTIONS` (Heading 1)**
Câu mở đầu giới thiệu phần khuyến nghị kỹ thuật sơ bộ.
- **`Complete Technical Stack` (Heading 3)** → bullet list dạng `<Layer>: <công nghệ/ghi chú>` (Frontend, Backend, Database, Security Layer, Integrations, Secrets, Monitoring...). Kèm khối con "Security & Compliance:" gồm các bullet (Encryption, Authentication, Isolation, Synthetic Data, Infrastructure Management, Presentation Layer Role).
- **`System Architecture` (Heading 3)** → 1 đoạn mô tả kiến trúc + một list ngắn liệt kê các site/thành phần chính (vd Bank Site, Borrower Site, Admin Site).

**`ROADMAP & PHASES` (Heading 1)**
- **`In Scope Functions` (Heading 3)** → chia theo từng portal/module (A, B, C...), mỗi module có sub-list các nhóm chức năng (`<Nhóm>: <chi tiết>`).
- **`Roadmap` (Heading 3)** → chia theo Sprint (vd Sprint 1 / Weeks 1–2). Mỗi sprint gồm: dòng **Focus** (mục tiêu) + **Key Deliverables** (list lồng nhau theo site/service).
- **`Practical Limitations` (Heading 3)** → bullet list rủi ro/giới hạn thực tế (`<Tên>: <mô tả>`).
- **`Out-of-Scope Features` (Heading 3)** → bullet list những gì KHÔNG làm (`<Tên>: <mô tả>`).

**`DELIVERABLES` (Heading 1)**
Câu mở đầu + bullet list các hạng mục bàn giao (source code, tài liệu BRS/SRS, wireframe/UI-UX, test cases & reports, deployment guideline...).

**`SCHEDULE & COST` (Heading 1)**
- **`Working Breakdown Structure` (Heading 2)** → 1 câu nêu mô hình làm việc (agile, sprint 2 tuần) + **một bảng WBS lớn**, cấu trúc cột: `# | Category | Function | Sub-Function | Notes`. Các dòng nhóm theo section header (Common, Bank (Lender) Site, Borrower Site, Admin Site, Nonfunctional requirements). Một số dòng có thể đánh dấu `<Not in scope>`.
- **`Cost & Budget estimation` (Heading 2)** → 1 dòng "Investment required..." + tiêu đề scope (vd "MVP (6 weeks)") + **bảng chi phí**, cấu trúc cột: `Position | 1st month | 2nd month | ... | Total (M/M) | Unit Price (USD) | Total Cost (USD)`. Role: PM, BA & UI/UX Designer, BE Engineer, FE Engineer, QC Engineer, DevOps... Dòng cuối **TOTAL** tổng hợp man-month và tổng tiền.

**`PAYMENT MILESTONE` (Heading 1)**
**Bảng milestone thanh toán**, cấu trúc cột: `Milestone | Deliverable | Percentage | Due Timeline`. Các mốc điển hình: M1 Contract Signing (40%), M2 Demo (30%), M3 Staging & UAT (20%), M4 Finish UAT (10%). Tổng % phải = 100%.

## 3. Quy ước fill dữ liệu (cho Claude Code)

- Mọi field (`[Tên sản phẩm]`, `[Vendor]`, `[Ngày]`, bullet, dòng bảng) → lấy từ reports đầu vào. Nếu report thiếu field nào, để placeholder rõ ràng dạng `[TODO: <tên field>]` thay vì bịa.
- Giữ nguyên thứ tự section và cấp heading (Heading 1/2/3) để document outline render đúng.
- Các bảng phải là **bảng thật** trong .docx (không phải text phân tách bằng tab).
- Tính toán cột tổng (Total M/M, Total Cost, tổng %) từ dữ liệu, không copy số cứng nếu input cấp số chi tiết.
- Số lượng portal/site, số sprint, số tháng trong bảng cost là **động** — sinh theo đúng số liệu trong report, không cố định 3 site / 3 sprint / 2 tháng.
- Đơn vị tiền tệ và format ($, dấu phẩy ngàn) giữ nhất quán.

## 4. Mapping report → section

| Nội dung trong report | Section đích |
|---|---|
| Overview / business model | `OVERVIEW` + `Core Business Model` |
| Tech stack & compliance | `ASSUMPTIONS` (`Complete Technical Stack`, `System Architecture`) |
| Danh sách feature theo module | `In Scope Functions` + bảng `WBS` |
| Kế hoạch theo tuần / sprint | `Roadmap` |
| Rủi ro / phụ thuộc | `Practical Limitations` |
| Hạng mục loại trừ | `Out-of-Scope Features` |
| Hạng mục bàn giao | `DELIVERABLES` |
| Ước lượng effort / nhân sự | bảng `Cost & Budget estimation` |
| Điều khoản thanh toán | `PAYMENT MILESTONE` |

---

## Phụ lục A — Ví dụ nội dung mẫu (reference style)

### OVERVIEW (ví dụ)
Shvely là nền tảng B2B SaaS dành cho các tổ chức tài chính nhằm hiện đại hóa quy trình đánh giá rủi ro cho vay; tự động phân tích dữ liệu ngân hàng và xác minh tín dụng để ra quyết định nhanh và chính xác hơn dựa trên dữ liệu tài chính thời gian thực.

**Core Business Model (ví dụ bullet):**
- B2B SaaS Platform: nền tảng phục vụ tổ chức tài chính & bên cho vay.
- Simple Multi-Tenant Model: môi trường dữ liệu cô lập cho nhiều ngân hàng trên kiến trúc tập trung.
- Data Enrichment & Analytics: chuyển dữ liệu giao dịch thô thành chi tiêu phân loại, nguồn thu nhập đã xác minh, chỉ số rủi ro.
- Third-Party Integration Hub: tổng hợp & chuẩn hóa dữ liệu từ các API hạ tầng ngân hàng và credit bureau.
- Administrative Control: cấp quyền quản trị ở mức ứng dụng cho ngân hàng.

### ASSUMPTIONS — Complete Technical Stack (ví dụ)
- Frontend: Next.js (React) — Vercel
- Backend: Node.js/Express/TypeScript — Render
- Database: PostgreSQL (Supabase) + Row-Level Security
- Security Layer: Cloudflare (WAF, DDoS, TLS)
- Secrets: Doppler / Monitoring: Sentry
- Integrations: 1 banking infra API (Plaid/Teller) + 1 Credit Bureau (Experian/Equifax)

Security & Compliance: Encryption (AES-256 at rest, TLS 1.3 in transit); Auth (MFA TOTP cho admin, token-based cho borrower); Isolation (multi-tenancy qua RLS); Synthetic data ở non-prod; Infra do nhà cung cấp SOC 2 quản lý; Presentation layer chỉ render UI + gọi API.

### Roadmap (ví dụ cấu trúc sprint)
- Sprint 1 (Weeks 1–2): Foundation & Tenant Management — Focus + Key Deliverables (Infra setup, Admin Site auth/tenant mgmt, Bank Site onboarding/org mgmt).
- Sprint 2 (Weeks 3–4): Borrower Connectivity & Verification Loop.
- Sprint 3 (Weeks 5–6): Analytics, Campaigns & Finalization (+ UAT & Deployment).

### Cost & Budget (ví dụ bảng, MVP 6 weeks)
| Position | 1st month | 2nd month | Total (M/M) | Unit Price (USD) | Total Cost (USD) |
|---|---|---|---|---|---|
| PM | 0.5 | 0.25 | 0.75 | 3,500 | 2,625 |
| BA & UI/UX Designer | 1 | 0.5 | 1.5 | 3,000 | 4,500 |
| BE Engineer | 3 | 1.5 | 4.5 | 3,000 | 13,500 |
| FE Engineer (web app) | 2 | 1 | 3 | 3,000 | 9,000 |
| QC Engineer | 2 | 1 | 3 | 2,800 | 8,400 |
| DevOps | 0 | 0.5 | 0.5 | 3,600 | 1,800 |
| **TOTAL** | | | **18** | | **39,825.00** |

### Payment Milestone (ví dụ bảng)
| Milestone | Deliverable | % | Due Timeline |
|---|---|---|---|
| M1: Contract Signing | Signed agreement, kickoff | 40% | Upon contract execution |
| M2: Demo user-site functionalities | Functional platform demo | 30% | End of development phase |
| M3: Staging env & UAT start | Functional platform on staging + UAT | 20% | After successful staging deploy |
| M4: Finish UAT | Finish UAT + production deploy + docs | 10% | After all UAT bug fixes |