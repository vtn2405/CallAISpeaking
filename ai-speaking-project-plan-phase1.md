# AI Speaking Project Plan — Phase 1 Only

## Mục tiêu tài liệu
Tài liệu này chuyển ý tưởng trong bản mô tả dự án thành kế hoạch triển khai thực chiến chỉ cho phân hệ 1, tức web luyện nói tiếng Anh theo ngữ cảnh video YouTube, ưu tiên hội thoại giọng nói thời gian thực, phản xạ tự nhiên và môi trường ít áp lực cho người mới bắt đầu.[cite:1] Toàn bộ chi tiết về phân hệ 2 được xem là định hướng tương lai và không tham gia vào quyết định kỹ thuật của phase hiện tại.[cite:1]

## Nguyên tắc scope
Bản kế hoạch này chỉ dùng để xây phân hệ 1 và phải được đọc như một tài liệu “Phase 1 active, Phase 2 later”.[cite:1] Mọi quyết định về tính năng, kiến trúc, prompt và chi phí đều phải ưu tiên mục tiêu làm cho một buổi hội thoại 2–3 phút chạy ổn định trước khi nghĩ đến chấm IELTS, mock test hay pronunciation scoring.[cite:1]

## Mục tiêu sản phẩm
Phân hệ 1 có vai trò là “safe speaking practice”, giúp người học vượt qua nỗi sợ mở miệng, tăng phản xạ giao tiếp và tạo cảm giác đang nói chuyện với một người thật qua điện thoại thay vì trò chuyện với chatbot text thông thường.[cite:1] Người dùng dán một link YouTube có phụ đề, hệ thống tạo ngữ cảnh nội bộ từ transcript, rồi cho người dùng bắt đầu một phiên voice conversation ngắn với AI theo chủ đề video.[cite:1]

## In scope
- Dán link YouTube có phụ đề và nhận diện `videoId`.[cite:1]
- Lấy transcript kèm timestamp làm ngữ cảnh nội bộ.[cite:1]
- Tạo summary toàn video và chia transcript thành chunk để retrieval trong session.[cite:1]
- Voice pipeline cho hội thoại ngắn gồm STT, LLM và TTS.[cite:1]
- Màn hình nhập link và màn hình call cơ bản với mute, end call, subtitle.[cite:1]
- Session ngắn, chỉ giữ 8–10 lượt gần nhất và xóa transcript raw/chunk sau TTL ngắn.[cite:1]
- Prompt hội thoại thân thiện, trả lời ngắn 1–3 câu và bám chủ đề video.[cite:1]

## Out of scope
- Chấm band IELTS chính thức.[cite:1]
- Practice Mode, Mock Test hoặc logic Part 1–2–3.[cite:1]
- Pronunciation Assessment chi tiết.[cite:1]
- Answer upgrade, feedback học thuật sâu, band descriptor.[cite:1]
- Lưu transcript YouTube dài hạn hoặc cho tải transcript.[cite:1]
- Xây thư viện transcript tra cứu độc lập.[cite:1]

## User flow chính
1. Người dùng dán link YouTube có phụ đề.[cite:1]
2. Hệ thống trích transcript, tạo summary và chunk transcript để làm context nội bộ.[cite:1]
3. Người dùng vào màn hình call và bắt đầu nói bằng mic.[cite:1]
4. Hệ thống nhận giọng nói, chuyển thành text, kết hợp summary, các chunk liên quan và lịch sử hội thoại ngắn để tạo phản hồi.[cite:1]
5. AI trả lời ngắn 1–3 câu bằng giọng nói, giữ nhịp hội thoại tự nhiên và không chuyển sang chế độ chấm bài.[cite:1]
6. Nếu người dùng chen vào khi AI đang nói, hệ thống dừng audio và chuyển sang lượt nói mới của người dùng.[cite:1]

## Kiến trúc gợi ý
Kiến trúc hiện tại phải đủ đơn giản để một sinh viên có thể debug từng lớp, kiểm soát độ trễ và không bị chìm trong hạ tầng quá sớm.[cite:1] Mục tiêu kỹ thuật của phase này là làm cho chuỗi link YouTube → transcript context → free talk voice hoạt động ổn định trước khi mở rộng sang bất kỳ mode học thuật nào.[cite:1]

### Frontend
- Next.js hoặc React cho web app.
- Web Audio API để thu mic và phát audio.
- State machine đơn giản cho các trạng thái `idle`, `processing-link`, `ready`, `listening`, `thinking`, `speaking`, `interrupted`, `ended`.
- UI accessibility-first: nút đủ lớn, keyboard support, subtitle rõ và trạng thái mic rõ ràng.

### Backend
- Node.js hoặc TypeScript backend cho xử lý link YouTube, transcript, summary, chunk retrieval và session orchestration.
- API route hoặc server riêng cho pipeline xử lý context.
- WebSocket hoặc cơ chế realtime đơn giản cho luồng voice session.
- In-memory cache hoặc Redis nhẹ cho session ngắn nếu cần.[cite:1]

### AI services
- Azure Speech-to-Text cho nhận diện giọng nói theo thời gian thực.[cite:1]
- Azure Text-to-Speech cho phản hồi giọng nói.[cite:1]
- Một model hội thoại chính cho summary và free talk, ưu tiên phương án rẻ hoặc miễn phí trước khi nghĩ tới model mạnh hơn.[cite:1]

### AI routing tối giản cho Phase 1
Hệ thống không cần một router phức tạp ở giai đoạn này, nhưng vẫn nên có routing theo luật nghiệp vụ để tối ưu chi phí và giữ kiến trúc sạch.[cite:1] Chỉ cần chia làm ba loại tác vụ: xử lý transcript, tạo summary và free talk theo video context; chưa cần route cho chấm bài hay pronunciation vì các phần đó chưa nằm trong phase hiện tại.[cite:1]

| Task type | Hướng xử lý |
|---|---|
| Transcript extraction / chunking | Xử lý ở backend bằng logic thường, không cần model mạnh.[cite:1] |
| Summary video | Dùng model rẻ hoặc miễn phí trước, miễn đủ hiểu ngữ cảnh video.[cite:1] |
| Free talk grounded | Dùng một model chính, ưu tiên phản hồi nhanh, câu ngắn và chi phí thấp.[cite:1] |
| Fallback khi transcript bẩn | Prompt an toàn: xin người dùng nói tiếp, hỏi lại hoặc trả lời ở mức tổng quát hơn thay vì bịa chi tiết.[cite:1] |

### Data layer
- PostgreSQL hoặc Supabase cho user, session metadata, summary và log tối thiểu.
- Transcript raw và chunk chỉ lưu tạm theo TTL ngắn để giảm rủi ro lưu trữ không cần thiết.[cite:1]

## Mốc triển khai

### Giai đoạn 1: Validate context flow
Mục tiêu là chứng minh luồng link YouTube → transcript → summary → grounded response thực sự hữu ích trước khi tối ưu voice realtime.[cite:1]
- Nhập link YouTube.
- Lấy transcript.
- Tạo summary.
- Tạo chunk retrieval.
- Test hội thoại text theo context video.

### Giai đoạn 2: Voice MVP
Mục tiêu là chứng minh người dùng thật sự thích nói bằng giọng nói với flow này.[cite:1]
- Mic input.
- STT ổn định.
- AI trả lời ngắn.
- TTS cơ bản.
- Session 2–3 phút chạy ổn định.[cite:1]

### Giai đoạn 3: Natural conversation
Mục tiêu là tăng cảm giác giống cuộc gọi thật mà vẫn giữ scope hẹp.[cite:1]
- VAD hoặc silence detection.
- Barge-in cơ bản.[cite:1]
- Retrieval theo chunk khi người dùng hỏi chi tiết video.[cite:1]
- Tune prompt để AI trả lời ngắn, thân thiện và bám chủ đề.[cite:1]

## Milestone 4 tuần gợi ý

| Tuần | Mục tiêu | Deliverable |
|---|---|---|
| Tuần 1 | Chốt scope và xử lý transcript | Nhập link YouTube, parse video, transcript, summary, fixed-time chunking |
| Tuần 2 | Hoàn thiện grounded conversation | Chat theo summary + chunk retrieval + prompt persona |
| Tuần 3 | Thêm voice | STT + TTS + call UI cơ bản |
| Tuần 4 | Ổn định demo | Session handling, subtitle, logging, test demo 2–3 phút |

## Backlog kỹ thuật
- YouTube link parser.
- Transcript extractor.
- Transcript chunker theo thời gian cố định (Fixed-time Chunking): do phụ đề tự động từ YouTube có thể không có dấu câu ổn định, hệ thống gom dữ liệu thô liên tục thành các cụm 45–60 giây dựa trên `start` và `duration` của timestamp thay vì phụ thuộc vào chia câu theo nghĩa.[cite:1]
- Summary generator.[cite:1]
- Retrieval service lấy top chunk liên quan.[cite:1]
- Prompt builder cho persona hội thoại, trong đó system prompt phải nói rõ context đến từ phụ đề YouTube tự động nên có thể thiếu dấu câu và viết hoa; mô hình cần tự chuẩn hóa để hiểu nội dung nhưng khi phản hồi cho người dùng thì bắt buộc viết đúng ngữ pháp, đủ dấu câu và viết hoa chuẩn để làm mẫu cho người mới học.
- STT stream handler.
- TTS playback queue.
- Barge-in interruption logic.[cite:1]
- Session lifecycle manager.[cite:1]
- Minimal analytics: latency, error, token/audio usage.
- Fallback handler khi transcript quá bẩn hoặc retrieval không đủ chắc chắn.[cite:1]

## Acceptance criteria cho MVP
MVP phân hệ 1 được xem là đạt khi người dùng có thể dán một link YouTube có phụ đề, hệ thống tạo được context nội bộ, bắt đầu một cuộc hội thoại giọng nói ngắn, AI trả lời ngắn và bám ngữ cảnh, đồng thời demo 2–3 phút chạy ổn định mà không vỡ session.[cite:1] Với câu hỏi chi tiết về một đoạn trong video dài, hệ thống phải ưu tiên truy xuất chunk liên quan thay vì chỉ trả lời từ summary tổng quát; nếu context không đủ chắc chắn thì phải fallback an toàn thay vì bịa nội dung.[cite:1]

## Rủi ro chính
- Độ trễ cao làm hỏng cảm giác hội thoại tự nhiên.[cite:1]
- Chỉ dùng summary sẽ khiến AI trả lời hời hợt ở video dài.[cite:1]
- Barge-in khó làm mượt nếu audio pipeline không ổn định.[cite:1]
- Phụ đề tự động có thể thiếu dấu câu, thiếu viết hoa và có lỗi chính tả ở các từ đồng âm, làm loãng chất lượng dữ liệu retrieval; hướng xử lý là để mô hình summary và hội thoại tự chuẩn hóa ngữ cảnh thô thay vì kỳ vọng transcript đầu vào đã sạch.[cite:1]
- Nếu ôm quá nhiều logic cho phase sau, roadmap hiện tại sẽ bị trôi scope và chậm demo phân hệ 1.[cite:1]
- Lưu transcript quá lâu có thể tạo rủi ro về lưu trữ và sử dụng nội dung video không cần thiết.[cite:1]

## Future phase
Phân hệ 2 vẫn có thể tồn tại như một hướng mở rộng sau này, nhưng không được dùng để kéo thay đổi kỹ thuật vào phase hiện tại.[cite:1] Các nội dung như Mock Test, band scoring, answer upgrade và pronunciation assessment chỉ nên quay lại sau khi phân hệ 1 đã có user flow ổn định và được kiểm chứng.[cite:1]

## Cách dùng Markdown này với AI
Dùng file này làm “master prompt” cho phân hệ 1. Mỗi lần làm việc với AI, chỉ giao một nhiệm vụ rõ ràng, ví dụ:

- “Dựa trên project plan Phase 1 này, hãy thiết kế database schema tối thiểu.”
- “Dựa trên project plan Phase 1 này, hãy sinh task breakdown cho tuần 1.”
- “Dựa trên project plan Phase 1 này, hãy code service xử lý transcript summary chunk.”
- “Dựa trên project plan Phase 1 này, hãy review scope xem có chỗ nào lỡ dính sang phân hệ 2 không.”

## Quy trình làm việc đề xuất
1. Đưa DOCX cho AI để rút gọn thành một bản Markdown chuẩn hóa.[cite:1]
2. Khóa scope chỉ còn phân hệ 1 và chuyển mọi ý tưởng khác xuống mục future phase.[cite:1]
3. Dùng Markdown đó để tạo task list triển khai.
4. Chỉ sau đó mới yêu cầu AI code từng module.
5. Sau mỗi tuần, cập nhật lại file plan thay vì tiếp tục chat rời rạc.

## Kết luận sử dụng
File này là tài liệu điều phối cho phase hiện tại và phải luôn được ưu tiên hơn các cuộc chat rời rạc sau này.[cite:1] Nếu một ý tưởng mới không giúp phân hệ 1 chạy ổn định hơn, ý tưởng đó nên được ghi vào future phase thay vì đưa vào sprint hiện tại.[cite:1]
