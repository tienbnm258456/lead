/** Display mapping from K2S - Order statuses - 05.11.2026.pdf. Keep raw CRM codes in storage. */
export const CRM_STATUS_GROUPS = {
  "new": {
    "label": "Đơn mới",
    "color": "#d99416"
  },
  "processing": {
    "label": "Đang xử lý",
    "color": "#3b82f6"
  },
  "reconfirmation": {
    "label": "Cần xử lý / xác nhận lại",
    "color": "#ea7c26"
  },
  "confirmed": {
    "label": "Đã xác nhận",
    "color": "#14966c"
  },
  "assembly": {
    "label": "Soạn hàng",
    "color": "#8b5cf6"
  },
  "delivery": {
    "label": "Giao hàng",
    "color": "#0891b2"
  },
  "completed": {
    "label": "Hoàn thành",
    "color": "#169b58"
  },
  "cancelled": {
    "label": "Hủy / hoàn hàng",
    "color": "#dc5656"
  },
  "refund": {
    "label": "Hoàn tiền",
    "color": "#c05ccf"
  }
} as const;
export type CrmStatusGroup = keyof typeof CRM_STATUS_GROUPS;
export interface CrmStatusDisplay { code: string | null; label: string; description: string; group: CrmStatusGroup | null; groupLabel: string; color: string; known: boolean }
export const CRM_STATUS_MAPPING: Record<string, { group: CrmStatusGroup; label: string; description: string }> = {
  "goriachii": {
    "group": "new",
    "label": "Đơn mới ưu tiên",
    "description": "Đơn mới được ưu tiên để sale liên hệ trước."
  },
  "new": {
    "group": "new",
    "label": "Đơn mới — chờ gọi xác nhận",
    "description": "Đã nhận đơn, chờ sale gọi khách xác nhận."
  },
  "1d-nedozvon": {
    "group": "new",
    "label": "Chưa liên hệ được — giai đoạn 1",
    "description": "Các cuộc gọi đầu chưa có người nghe; vẫn tiếp tục liên hệ."
  },
  "2d-nedozvon": {
    "group": "new",
    "label": "Chưa liên hệ được — giai đoạn 2",
    "description": "Tiếp tục liên hệ nhưng khách chưa nghe máy; chưa đóng đơn."
  },
  "perezvon-1": {
    "group": "processing",
    "label": "Khách hẹn gọi lại",
    "description": "Khách yêu cầu gọi lại vào thời gian đã hẹn."
  },
  "perezvon-no-reply-1": {
    "group": "processing",
    "label": "Gọi lại không nghe máy — lần 1",
    "description": "Khách không nghe cuộc gọi lại lần đầu."
  },
  "perezvon-no-reply-2": {
    "group": "processing",
    "label": "Gọi lại không nghe máy — lần 2",
    "description": "Khách không nghe cuộc gọi lại lần hai."
  },
  "perezvon-no-reply-3": {
    "group": "processing",
    "label": "Gọi lại không nghe máy — lần 3",
    "description": "Khách không nghe cuộc gọi lại lần ba."
  },
  "telegram": {
    "group": "processing",
    "label": "Đang tư vấn qua Telegram",
    "description": "Đang trao đổi đơn hàng với khách qua Telegram."
  },
  "tg-bot-podtverzhdenie": {
    "group": "processing",
    "label": "Chờ xác nhận qua bot Telegram",
    "description": "Đã gửi yêu cầu xác nhận qua bot, đang chờ khách trả lời."
  },
  "podtverzhden-cherez-bota": {
    "group": "processing",
    "label": "Đã xác nhận qua bot — chờ upsell",
    "description": "Khách đã xác nhận qua bot; sale có thể liên hệ tư vấn mua thêm."
  },
  "preorder": {
    "group": "reconfirmation",
    "label": "Đặt trước — chờ hàng về",
    "description": "Chưa đủ tồn kho; đơn đang chờ hàng về."
  },
  "perepodtverdit-poiavilsia-tovar": {
    "group": "reconfirmation",
    "label": "Hàng đã về — chờ xác nhận lại",
    "description": "Hàng đã có; sale cần hỏi khách còn nhu cầu nhận đơn không."
  },
  "perepodtverdit-net-xml-koda": {
    "group": "reconfirmation",
    "label": "Thiếu mã XML sản phẩm",
    "description": "Sản phẩm thiếu mã XML phục vụ trao đổi dữ liệu; cần sửa cấu hình sản phẩm."
  },
  "perepodtverdit-net-tovara": {
    "group": "reconfirmation",
    "label": "Thiếu hàng — chờ xử lý",
    "description": "Phát hiện thiếu hàng sau xác nhận; đang thỏa thuận thay thế hoặc chờ hàng, chưa hủy."
  },
  "oshibka-sborki": {
    "group": "reconfirmation",
    "label": "Lỗi soạn hàng",
    "description": "Kho báo vấn đề khi soạn hàng; đang làm rõ nguyên nhân."
  },
  "oshibka-ne-naiden-gorod-v-emu": {
    "group": "reconfirmation",
    "label": "EMU không nhận diện thành phố",
    "description": "Cần sửa địa chỉ và đặt lại giao hàng vì EMU không nhận diện được thành phố."
  },
  "reconfirmation": {
    "group": "reconfirmation",
    "label": "Đang xác nhận lại với khách",
    "description": "Đang kiểm tra lại thông tin và thống nhất đơn với khách."
  },
  "approve-cod": {
    "group": "confirmed",
    "label": "Đã xác nhận — COD",
    "description": "Khách xác nhận, thanh toán khi nhận hàng; chuyển đơn sang soạn hàng."
  },
  "podtverzhden-samovyvoz-yandex": {
    "group": "confirmed",
    "label": "Đã xác nhận — tự lấy / Yandex",
    "description": "Khách tự đến lấy hoặc nhận hàng qua Yandex."
  },
  "pere-podtverzhden-sod": {
    "group": "confirmed",
    "label": "Đã xác nhận lại — COD",
    "description": "Đã xác nhận lại với khách; thanh toán khi nhận hàng."
  },
  "assembling": {
    "group": "assembly",
    "label": "Đang soạn hàng",
    "description": "Kho đang soạn và chuẩn bị gửi hàng."
  },
  "sobran": {
    "group": "assembly",
    "label": "Đã soạn xong — chờ gửi",
    "description": "Đã soạn xong, sẵn sàng gửi hàng."
  },
  "delivering": {
    "group": "delivery",
    "label": "Đang giao hàng",
    "description": "Đã bàn giao cho đơn vị vận chuyển, chưa có kết quả cuối."
  },
  "urgent": {
    "group": "delivery",
    "label": "Cần gọi khách gấp",
    "description": "Cần liên hệ khách gấp trong quá trình giao hàng."
  },
  "dop-prozvon": {
    "group": "delivery",
    "label": "Cần gọi bổ sung về giao hàng",
    "description": "Cần gọi thêm để làm rõ thông tin giao hàng."
  },
  "call-emu": {
    "group": "delivery",
    "label": "EMU — cần gọi người nhận",
    "description": "Cần làm rõ tình hình với người nhận đơn do EMU giao."
  },
  "perenos-emu": {
    "group": "delivery",
    "label": "EMU — hẹn lại lịch giao",
    "description": "Đang chuyển lịch giao sang thời gian khác; đơn chưa hoàn tất."
  },
  "otkaz-emu-predvaritelno": {
    "group": "delivery",
    "label": "EMU — khách từ chối sơ bộ",
    "description": "Khách từ chối ban đầu; chưa có kết quả giao hoặc hoàn cuối cùng, chưa hủy đơn."
  },
  "plan-vozvrat": {
    "group": "delivery",
    "label": "Dự kiến hoàn hàng",
    "description": "Dự kiến trả hàng nhưng hàng chưa về kho; chưa hoàn xong."
  },
  "uterian": {
    "group": "delivery",
    "label": "Giao chậm — kiểm tra thất lạc",
    "description": "Kiện giao lâu bất thường, đang kiểm tra với đơn vị vận chuyển; chưa khẳng định đã mất hàng."
  },
  "chast-vozvrat-ruchnaia-proverka": {
    "group": "delivery",
    "label": "Hoàn một phần — chờ đối soát",
    "description": "Một phần hàng đã về; cần đối soát thủ công hàng giao, hàng hoàn và số tiền."
  },
  "complete": {
    "group": "completed",
    "label": "Đã giao hàng",
    "description": "Đã giao khách; việc thanh toán hoặc đối soát tiền có thể chưa hoàn tất."
  },
  "payoff": {
    "group": "completed",
    "label": "Đã giao và đã thanh toán",
    "description": "Đã giao và nhận thanh toán; đơn kết thúc thành công."
  },
  "payoff-partly": {
    "group": "completed",
    "label": "Đã giao — thanh toán một phần",
    "description": "Đã giao nhưng chưa thanh toán đủ; cần đối soát hàng và tiền."
  },
  "dostavlen-predvaritelno": {
    "group": "completed",
    "label": "Đã giao sơ bộ — chờ xác nhận",
    "description": "Mới có thông báo giao sơ bộ; còn chờ xác nhận cuối và đối soát thanh toán."
  },
  "no-call": {
    "group": "cancelled",
    "label": "Đã đóng — không liên hệ được",
    "description": "Không liên hệ được sau tất cả các lần thử; đã đóng đơn."
  },
  "cancel-other": {
    "group": "cancelled",
    "label": "Đã hủy — lý do khác",
    "description": "Đã hủy vì lý do khác, ví dụ khách đổi ý."
  },
  "duplicate": {
    "group": "cancelled",
    "label": "Đơn trùng",
    "description": "Đơn trùng với đơn khác, không thực hiện."
  },
  "trash": {
    "group": "cancelled",
    "label": "Đơn không hợp lệ",
    "description": "Đơn sai hoặc không có thật, không thực hiện."
  },
  "testy": {
    "group": "cancelled",
    "label": "Đơn thử nghiệm",
    "description": "Đơn được tạo để thử nghiệm, không thực hiện."
  },
  "otmena-net-tovara": {
    "group": "cancelled",
    "label": "Đã hủy do hết hàng",
    "description": "Đã hủy chính thức do không có hàng, không còn ở bước tìm phương án xử lý."
  },
  "return": {
    "group": "cancelled",
    "label": "Đã hoàn hàng",
    "description": "Đã ghi nhận hoàn hàng, không tính là giao thành công."
  },
  "refund-req": {
    "group": "refund",
    "label": "Đã yêu cầu hoàn tiền",
    "description": "Đã yêu cầu hoàn tiền cho khách, tiền chưa được hoàn."
  },
  "refund-done": {
    "group": "refund",
    "label": "Đã hoàn tiền",
    "description": "Đã hoàn tiền cho khách."
  }
};
export function getCrmStatusDisplay(code?: string | null): CrmStatusDisplay {
  if (!code) return { code: null, label: 'Chờ xác nhận', description: 'Chưa nhận được trạng thái CRM. Đây là nhãn tạm hiển thị, không phải mã trạng thái của đối tác.', group: null, groupLabel: 'Chưa có trạng thái CRM', color: '#d99416', known: false };
  const status = Object.hasOwn(CRM_STATUS_MAPPING, code) ? CRM_STATUS_MAPPING[code] : undefined;
  if (!status) return { code, label: code, description: 'Mã trạng thái CRM chưa có bản dịch.', group: null, groupLabel: 'Chưa phân nhóm', color: '#64748b', known: false };
  const group = CRM_STATUS_GROUPS[status.group];
  return { code, ...status, groupLabel: group.label, color: group.color, known: true };
}
