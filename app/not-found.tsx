import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-md text-center space-y-6">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          주소가 잘못되었거나 삭제된 페이지일 수 있습니다. 홈으로 돌아가 계속 이용해 주세요.
        </p>
        <Button asChild>
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    </div>
  )
}
