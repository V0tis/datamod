import { redirect } from 'next/navigation'

/** 대시보드 UI는 루트(`/`)에 있습니다. */
export default function DashboardAliasPage() {
  redirect('/')
}
