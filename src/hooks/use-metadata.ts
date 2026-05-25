import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useMetadata() {
  const location = useLocation()

  useEffect(() => {
    // 1. Update canonical URL dynamically
    let canonical = document.querySelector('link[rel="canonical"]')
    const currentUrl = `https://www.chronelis.io.vn${location.pathname}`
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', currentUrl)

    // 2. Dynamic titles for SEO
    const path = location.pathname.substring(1)
    if (path) {
      // Map routes to pretty titles
      const segment = path.split('/')[0]
      const titles: Record<string, string> = {
        login: 'Đăng nhập',
        register: 'Đăng ký',
        dashboard: 'Bảng điều khiển',
        'my-work': 'Việc của tôi',
        workspaces: 'Không gian làm việc',
        notifications: 'Thông báo',
        profile: 'Trang cá nhân',
        pricing: 'Bảng giá',
        features: 'Tính năng',
        integrations: 'Tích hợp',
        changelog: 'Nhật ký thay đổi',
        about: 'Giới thiệu',
        roadmap: 'Lộ trình',
        guides: 'Hướng dẫn',
        contact: 'Liên hệ',
      }
      const pageTitle = titles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ')
      document.title = `Chronelis | ${pageTitle}`
    } else {
      document.title = 'Chronelis | Quản lý công việc nhóm trong một không gian thống nhất'
    }
  }, [location])
}
