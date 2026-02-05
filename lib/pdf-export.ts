/**
 * 리포트 영역을 PDF로 저장하기 위해 인쇄 대화상자를 엽니다.
 * 사용자가 "대상: PDF로 저장"을 선택하면 PDF 파일로 저장할 수 있습니다.
 */
export function printReportAsPdf(): void {
  if (typeof window === 'undefined') return
  window.print()
}
