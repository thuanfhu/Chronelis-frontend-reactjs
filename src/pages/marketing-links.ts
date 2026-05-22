export type LocaleText = {
  en: string
  vi: string
}

type FooterGroup = {
  title: LocaleText
  links: {
    to: string
    label: LocaleText
  }[]
}

export const marketingFooterGroups: FooterGroup[] = [
  {
    title: { en: 'Product', vi: 'Sản phẩm' },
    links: [
      { to: '/features', label: { en: 'Features', vi: 'Tính năng' } },
      { to: '/integrations', label: { en: 'Integrations', vi: 'Tích hợp' } },
      { to: '/pricing', label: { en: 'Pricing', vi: 'Bảng giá' } },
      { to: '/changelog', label: { en: 'Changelog', vi: 'Cập nhật' } },
    ],
  },
  {
    title: { en: 'Resources', vi: 'Tài nguyên' },
    links: [
      { to: '/about', label: { en: 'About Chronelis', vi: 'Về Chronelis' } },
      { to: '/roadmap', label: { en: 'Roadmap', vi: 'Lộ trình' } },
      { to: '/guides', label: { en: 'Guides', vi: 'Hướng dẫn' } },
      { to: '/contact', label: { en: 'Contact', vi: 'Liên hệ' } },
    ],
  },
  {
    title: { en: 'Legal', vi: 'Pháp lý' },
    links: [
      { to: '/privacy', label: { en: 'Privacy Policy', vi: 'Chính sách bảo mật' } },
      { to: '/terms', label: { en: 'Terms of Service', vi: 'Điều khoản dịch vụ' } },
      { to: '/cookies', label: { en: 'Cookie Policy', vi: 'Chính sách Cookie' } },
    ],
  },
]

export const marketingFooterUtilityLinks = [
  { to: '/roadmap', label: { en: 'Roadmap', vi: 'Lộ trình' } },
  { to: '/contact', label: { en: 'Contact', vi: 'Liên hệ' } },
  { to: '/privacy', label: { en: 'Privacy', vi: 'Bảo mật' } },
] satisfies { to: string; label: LocaleText }[]
