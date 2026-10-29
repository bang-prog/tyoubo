/** 入力の間違いなど、利用者に直してもらうエラー。message はそのまま画面に出す。 */
export class ValidationError extends Error {
  name = 'ValidationError'
}

/** 画面に表示するエラーの文。想定外のエラーは中身を出さず、もう一度試してもらう。 */
export function userMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message
  console.error(error)
  return '保存できませんでした。もう一度お試しください。'
}
