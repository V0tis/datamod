import { redirect } from 'next/navigation'

/** /settings/license → /settings?tab=license 리다이렉트 */
export default function SettingsLicensePage() {
  redirect('/settings?tab=license')
}
