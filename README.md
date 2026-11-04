# Sổ nhà — Thu chi gia đình

Ứng dụng ghi thu chi cho một gia đình, chạy trên trình duyệt.

- Tài khoản ngân hàng, thẻ tín dụng và ví điện tử
- Thêm, sửa, xóa tài khoản và điều chỉnh số dư
- Danh mục thu/chi, danh mục con, mỗi danh mục một màu
- Lịch sử thu, chi, chuyển tiền và điều chỉnh số dư
- Dữ liệu lưu trên trình duyệt; có xuất và nhập file sao lưu

Số dư thẻ là **dư nợ**. Chi bằng thẻ làm nợ tăng. Chuyển tiền vào thẻ (trả nợ) làm nợ giảm và không tính là một khoản chi mới.

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Kiểm tra sổ cái bằng `npm test`, đóng gói bằng `npm run build`.
