# Test Case: Xử lý trộn lẫn Anh-Việt (Code-switch) — Beginner Mode & Video Chat Mode

Bối cảnh giả định: video mua sắm (shopping), Outline có nhân vật "Mia" (khách hàng) và "Leo" (nhân viên bán hàng).
Chạy từng case ở **cả 2 mode** (đổi `mode` trong session), so kết quả thực tế với "Expected" — đánh dấu PASS/FAIL.

---

## Nhóm 1 — Code-switch 1 từ, tín hiệu bí từ rõ ràng

| # | User nói | Beginner Mode — Expected | Video Chat Mode — Expected |
|---|---|---|---|
| 1.1 | "I want to buy a cái áo khoác" | Dịch "áo khoác" = jacket, giải thích ngắn, đưa sentence starter ("You can say: I want to buy a jacket.") | Trả lời tiếp tự nhiên bằng "jacket", không nhắc gì đến việc user chêm tiếng Việt |
| 1.2 | "Leo told her the giá is too high" | Dịch "giá" = price, sentence starter ("...the price is too high") | Tiếp mạch bằng "price", có thể hỏi sâu hơn ("Do you think the price was fair?") |
| 1.3 | "Tôi nghĩ Mia sẽ mua nó" (gần như nguyên câu tiếng Việt) | Dịch cả câu, đưa sentence starter đầy đủ ("I think Mia will buy it") | Hiểu ý, trả lời hoàn toàn bằng tiếng Anh, tiếp tục hỏi sâu — KHÔNG dừng lại dạy cả câu dài dòng |

**FAIL nếu**: AI nói "you were wrong" / "the correct way is" (đây là correction, không phải help) — cả 2 mode đều không được phép.

---

## Nhóm 2 — Cụm từ / thành ngữ tiếng Việt không có bản dịch trực tiếp 1-1

| # | User nói | Beginner Mode — Expected | Video Chat Mode — Expected |
|---|---|---|---|
| 2.1 | "She was rất là bực mình when the store closed" | Dịch "rất là bực mình" ≈ "really annoyed/frustrated", sentence starter | Dùng "really frustrated" hoặc "annoyed" tự nhiên, tiếp tục hội thoại |
| 2.2 | "Anh ấy just muốn thử vận may thôi" | Dịch "muốn thử vận may" ≈ "wanted to try his luck", giải thích ngắn | Dùng "tried his luck" mượt trong câu trả lời, đẩy câu hỏi tiếp theo |

**Chú ý khi chấm**: cụm idiomatic không có bản dịch chính xác 1-1 — kiểm tra AI có chọn nghĩa **hợp lý theo ngữ cảnh video** hay dịch máy móc/sai nghĩa.

---

## Nhóm 3 — Filler / từ đệm tiếng Việt (KHÔNG phải bí từ thật — kiểm tra false positive)

| # | User nói | Expected (cả 2 mode) |
|---|---|---|
| 3.1 | "Ừm... she went to the store first" | KHÔNG kích hoạt Help Mode — "ừm" là từ đệm ngập ngừng, không phải bí từ. AI trả lời bình thường. |
| 3.2 | "À, I mean, Leo helped her" | KHÔNG kích hoạt Help Mode — chỉ là tự sửa lời tự nhiên (self-correction), không phải code-switch cần dịch. |

**FAIL nếu**: AI dừng lại "giải thích" từ "ừm"/"à" như thể đó là từ vựng cần dạy — dấu hiệu prompt đang overtrigger Help Mode.

---

## Nhóm 4 — Nhiều code-switch trong cùng 1 câu

| # | User nói | Beginner Mode — Expected | Video Chat Mode — Expected |
|---|---|---|---|
| 4.1 | "Mia đến cửa hàng và mua một cái túi xách màu đỏ" (gần như toàn Việt) | Dịch cả câu, đưa sentence starter cho toàn câu — KHÔNG dịch từng từ rời rạc gây rối | Trả lời hoàn toàn tiếng Anh, hiểu đúng ý ("a red handbag"), tiếp tục hỏi mà không dừng dạy từ vựng |

**FAIL nếu**: Beginner Mode liệt kê dịch từng từ một cách máy móc (kiểu "cửa hàng = store, mua = buy, túi xách = handbag...") thay vì gói gọn thành 1 câu mẫu tự nhiên.

---

## Nhóm 4b — Dừng giữa chừng hỏi 1 từ, mong được tiếp tục ý dở dang (Resume Behavior)

| # | User nói (có thể chia làm 2 lượt nói) | Beginner Mode — Expected | Video Chat Mode — Expected |
|---|---|---|---|
| 4b.1 | "I was so... tức giận là gì nhỉ... I can't continue" (1 turn) | Dịch "angry", dựng sentence starter NỐI TIẾP ý dở dang: "You can say: I was so angry when..." | Đưa từ "angry" ngắn gọn, sau đó nói "That's 'angry' — go ahead, finish your thought!" — KHÔNG tự hoàn thành câu hộ user |
| 4b.2 | Turn 1: "I was so..." (bỏ lửng) → Turn 2: "tức giận tiếng Anh là gì?" | AI phải dùng lịch sử hội thoại (turn 1) để biết ý dở dang là gì, không coi turn 2 là câu hỏi độc lập mới | Tương tự — vẫn phải nhớ ý turn 1 dù đã tách thành 2 turn riêng |
| 4b.3 | "Ừm... từ đó tiếng Anh là gì nhỉ" (không nói rõ từ nào — quá mơ hồ) | Nếu AI không xác định được user đang hỏi từ nào (do không có ngữ cảnh rõ trong history), nên hỏi lại ngắn gọn "Which word do you mean?" thay vì đoán bừa | Tương tự — không đoán bừa khi ngữ cảnh không đủ rõ |

**FAIL nếu**:
- AI dịch từ xong rồi tự chuyển sang câu hỏi hoàn toàn mới, bỏ mặc ý dở dang của user (vi phạm Resume Behavior).
- Ở Video Chat Mode, AI tự ý hoàn thành câu hộ user thay vì trả lại lượt nói (đây là hành vi dành riêng cho Beginner Mode, không phải Video Chat).
- Case 4b.2: AI không nhớ được turn trước, hỏi lại "what are you trying to say?" như thể chưa từng có ngữ cảnh — chứng tỏ history không được dùng đúng cho việc resume.

---



| # | User nói | Expected (cả 2 mode) |
|---|---|---|
| 5.1 | "I don't know how to say cửa hàng tiện lợi" | Chỉ kích hoạt Help Mode **1 lần**, xử lý gọn — không lặp lại 2 phản ứng chồng nhau (1 cho "don't know", 1 cho code-switch) |

**FAIL nếu**: phản hồi bị trùng lặp ý hoặc quá dài do xử lý 2 trigger như 2 việc tách biệt.

---

## Nhóm 6 — Tên riêng / thương hiệu không nên bị coi là "bí từ" (false positive)

| # | User nói | Expected (cả 2 mode) |
|---|---|---|
| 6.1 | "She bought it at Điện Máy Xanh" (tên cửa hàng thật, giữ nguyên tiếng Việt là đúng) | KHÔNG dịch tên riêng, không kích hoạt Help Mode vì đây — trả lời bình thường, coi như phần tự nhiên của câu |
| 6.2 | "Mia's friend is named Phương" | Không dịch tên người — tên riêng giữ nguyên |

**FAIL nếu**: AI cố "dịch" tên riêng hoặc coi đó là dấu hiệu bí từ.

---

## Nhóm 7 — User nói gần như toàn tiếng Việt (edge case nặng)

| # | User nói | Beginner Mode — Expected | Video Chat Mode — Expected |
|---|---|---|---|
| 7.1 | "Em không biết diễn tả sao, video này nói về một cô gái đi mua đồ ở siêu thị rồi gặp vấn đề gì đó với giá tiền" | Dịch/paraphrase lại ý chính bằng tiếng Anh đơn giản, đưa sentence starter, khuyến khích nhẹ nhàng, KHÔNG chê hay tỏ ra khó chịu vì câu toàn tiếng Việt | Hiểu ý, trả lời hoàn toàn tiếng Anh, tiếp tục hội thoại tự nhiên như đã hiểu đúng — không dừng lại "dạy" |

**Đây là case khó nhất** — kiểm tra xem model có "sụp" (trả lời lẫn tiếng Việt, hoặc từ chối trả lời) khi input gần như không có tiếng Anh nào không.

---

## Nhóm 8 — Regression check (đảm bảo không quay lại bug cũ)

| # | Việc cần kiểm tra | Cách check |
|---|---|---|
| 8.1 | AI không tự ý "chấm điểm" khi user trả lời **hoàn toàn bằng tiếng Anh** dù câu chưa hoàn hảo | Cho user trả lời 1 câu tiếng Anh có lỗi ngữ pháp nhẹ, không chêm tiếng Việt, không nói "I don't know" → AI phải trả lời thẳng vào nội dung, không sửa câu |
| 8.2 | AI không nói các cụm bị cấm | Grep log/response tìm: "a more natural way to say", "the correct way is", "you should say" — không được xuất hiện ở bất kỳ case nào trong nhóm 1-7 |
| 8.3 | Persona Mode không tự ý kích hoạt khi đang xử lý code-switch | Trong các case Nhóm 1-2, AI không được tự dưng chuyển sang roleplay nhân vật — 2 tính năng này độc lập nhau |

---

## Checklist tổng hợp

- [ ] Nhóm 1 (từ đơn) — Beginner PASS / FAIL — Video Chat PASS / FAIL
- [ ] Nhóm 2 (cụm từ) — Beginner PASS / FAIL — Video Chat PASS / FAIL
- [ ] Nhóm 3 (false positive - filler) — PASS / FAIL
- [ ] Nhóm 4 (nhiều code-switch) — Beginner PASS / FAIL — Video Chat PASS / FAIL
- [ ] Nhóm 4b (dừng giữa chừng, resume behavior) — Beginner PASS / FAIL — Video Chat PASS / FAIL
- [ ] Nhóm 5 (double trigger) — PASS / FAIL
- [ ] Nhóm 6 (false positive - tên riêng) — PASS / FAIL
- [ ] Nhóm 7 (edge case nặng) — Beginner PASS / FAIL — Video Chat PASS / FAIL
- [ ] Nhóm 8 (regression) — PASS / FAIL

Nếu Nhóm 3, 6, hoặc 8 fail → ưu tiên sửa ngay (đây là dấu hiệu prompt đang overtrigger hoặc quay lại đúng bug ban đầu).
Nếu Nhóm 7 fail → cân nhắc test thêm với input tiếng Việt nặng hơn để xác định ngưỡng model bắt đầu "sụp".