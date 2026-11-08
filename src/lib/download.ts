/** ファイルを端末に保存する。iPhone や iPad では、保存先を選ぶ画面が出る。 */
export function downloadFile(data: BlobPart, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // すぐに消すと保存が始まらないブラウザがあるので、少し待ってから消す
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const JSON_MIME = 'application/json'
