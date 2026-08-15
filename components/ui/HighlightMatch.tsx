/** Tô sáng phần chữ khớp với từ khoá tìm kiếm — plain-match (không bỏ dấu),
 * dùng cho các danh sách có ô tìm/lọc nhanh trong app Booking. */
export default function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const index = text.toLowerCase().indexOf(q.toLowerCase())
  if (index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-green-100 px-0.5 font-semibold text-green-800">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  )
}
