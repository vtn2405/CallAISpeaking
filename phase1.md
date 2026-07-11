# PRD — Phase 1

## Mục tiêu
Phase 1 là sản phẩm luyện speaking theo ngữ cảnh video YouTube, tập trung vào hội thoại giọng nói tự nhiên cho người mới bắt đầu và người ngại nói với người thật.[cite:1]

## Vấn đề cần giải quyết
Người học cần một môi trường an toàn để mở miệng nói, có chủ đề cụ thể, ít áp lực và phản hồi đủ tự nhiên để duy trì cuộc hội thoại ngắn.[cite:1]

## Người dùng mục tiêu
- Người mới học speaking.
- Người ngại giao tiếp với người thật.
- Người muốn luyện phản xạ nói từ nội dung video quen thuộc.

## Giá trị cốt lõi
- Dán link YouTube có phụ đề.
- Hệ thống đọc transcript và tạo ngữ cảnh nội bộ.
- Người dùng trò chuyện bằng voice với AI theo chủ đề video.
- AI trả lời ngắn, tự nhiên, không chấm điểm học thuật ở phase này.[cite:1]

## Phạm vi tính năng
### In scope
- Nhập link YouTube.
- Trích transcript có timestamp.
- Chunk toàn bộ video bằng fixed-time chunking.
- Tạo summary toàn video.
- Grounded conversation theo summary + chunk.
- Voice input/output với STT và TTS.
- Call UI tối giản.
- Session ngắn và lưu metadata tối thiểu.[cite:1]

### Out of scope
- Chấm band IELTS.
- Mock test Part 1/2/3.
- Pronunciation scoring chi tiết.
- Feedback học thuật sâu.
- Lưu transcript dài hạn.[cite:1]

## User flow
1. User dán link YouTube.
2. Backend lấy transcript và tạo summary/chunk.
3. User vào màn call.
4. User nói, hệ thống nhận STT.
5. LLM tạo phản hồi ngắn dựa trên context.
6. TTS phát phản hồi cho user.
7. Nếu user chen vào, AI dừng để nhận lượt nói mới.[cite:1]

## Acceptance criteria
- Có thể bắt đầu cuộc hội thoại từ link YouTube có phụ đề.
- Video dài vẫn hỏi được đoạn bất kỳ vì chunk toàn bộ từ đầu.[cite:1]
- Demo 2–3 phút chạy ổn định.
- AI trả lời ngắn, bám ngữ cảnh và không trôi sang chế độ chấm điểm.[cite:1]

## Future phase
Phase 2 sẽ bổ sung luyện thi IELTS có cấu trúc, chấm điểm và pronunciation assessment, nhưng không tham gia vào quyết định kỹ thuật của phase 1.[cite:1]
