import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import ColorBends from '@/components/ColorBends'
import { CheckCircle2, Layout, Zap, Users, ArrowRight, Star, LogOut, ArrowUp, User, ShieldCheck } from 'lucide-react'
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import TrueFocus from '@/components/TrueFocus'
import { useAuthStore } from '@/app/store/auth-store'
import { isAdminUser } from '@/lib/auth/role-utils'
import { useUiStore } from '@/app/store/ui-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { marketingFooterGroups } from '@/pages/marketing-links'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const isVi = i18n.language === 'vi'
  const currentUser = useAuthStore((state) => state.currentUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()
  const theme = useUiStore((state) => state.theme)
  const logoSrc = theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'
  const canAccessAdmin = isAdminUser(currentUser)

  const [showScrollTop, setShowScrollTop] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const kanbanCols = [
    {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20 text-red-600 dark:text-red-400',
      title: isVi ? 'Cần làm' : 'To Do',
      count: 3,
      items: [
        {
          title: isVi ? 'Thiết kế màn hình đăng nhập' : 'Design Login Screen',
          subtasks: '0/3',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
          tags: [isVi ? 'Thiết kế' : 'Design', isVi ? 'Giao diện' : 'UI/UX'],
          tagColors: [
            'bg-pink-500/10 text-pink-600 dark:text-pink-400',
            'bg-purple-500/10 text-purple-600 dark:text-purple-400',
          ],
        },
        {
          title: isVi ? 'Cập nhật API tài liệu' : 'Update API Docs',
          subtasks: '1/4',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
          tags: ['API', isVi ? 'Tài liệu' : 'Docs'],
          tagColors: [
            'bg-blue-500/10 text-blue-600 dark:text-blue-400',
            'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          ],
        },
      ],
    },
    {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
      title: isVi ? 'Đang tiến hành' : 'In Progress',
      count: 2,
      items: [
        {
          title: isVi ? 'Sửa lỗi thanh toán Stripe' : 'Fix Stripe Payment Bug',
          subtasks: '2/2',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80',
          tags: [isVi ? 'Lỗi' : 'Bug', isVi ? 'Thanh toán' : 'Stripe'],
          tagColors: [
            'bg-red-500/10 text-red-600 dark:text-red-400',
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          ],
        },
      ],
    },
    {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20 text-green-600 dark:text-green-400',
      title: isVi ? 'Hoàn thành' : 'Done',
      count: 5,
      items: [
        {
          title: 'Review code PR #102',
          subtasks: '3/3',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80',
          tags: ['GitHub', 'Review'],
          tagColors: [
            'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
            'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
          ],
        },
        {
          title: isVi ? 'Họp kế hoạch tuần' : 'Weekly Planning Meeting',
          subtasks: '1/1',
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80',
          tags: [isVi ? 'Hội họp' : 'Meeting', isVi ? 'Kế hoạch' : 'Planning'],
          tagColors: [
            'bg-teal-500/10 text-teal-600 dark:text-teal-400',
            'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
          ],
        },
      ],
    },
  ]

  const testimonials = [
    {
      name: 'Sarah Jenkins',
      role: isVi ? 'Quản lý sản phẩm' : 'Product Manager',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      text: isVi
        ? 'Thực sự mà nói, chúng tôi đã thử qua đủ loại công cụ quản lý dự án, nhưng Chronelis ở một đẳng cấp hoàn toàn khác. Giao diện siêu nhanh và mượt đến mức mọi người trong đội giờ đây tự giác cập nhật công việc mà không cần nhắc nhở.'
        : "Honestly, we've tried every project tool out there, but Chronelis is on another level. The UI is so fast and fluid that my team actually enjoys updating their tasks now!",
    },
    {
      name: 'David Chen',
      role: 'CTO',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      text: isVi
        ? 'Với vai trò CTO, tôi đề cao nhất là sự ổn định và tốc độ. Khả năng đồng bộ thời gian thực của Chronelis hoạt động mượt như nhung, còn bộ đếm Pomodoro tích hợp là một bước ngoặt lớn giúp các kỹ sư tập trung cao độ.'
        : 'As a CTO, stability and speed are everything. The real-time sync in Chronelis works like magic, and the built-in Pomodoro timer is a game-changer for our engineers.',
    },
    {
      name: 'Elena Rodriguez',
      role: isVi ? 'Trưởng nhóm Thiết kế' : 'Lead Designer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      text: isVi
        ? 'Tính thẩm mỹ trong thiết kế của Chronelis thực sự rất tuyệt vời. Thật hiếm thấy một công cụ nào cân bằng được giữa tính năng mạnh mẽ với một giao diện tối giản, hiện đại và tràn đầy cảm hứng như thế này.'
        : "The design aesthetics of Chronelis are absolutely brilliant. It's rare to find a tool that balances robust features with such a clean, modern, and inspiring visual design.",
    },
    {
      name: 'Minh Tuấn',
      role: isVi ? 'Kỹ sư Phần mềm' : 'Software Engineer',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
      text: isVi
        ? 'Mình cực kỳ thích việc có thể theo dõi mục tiêu chung của cả đội rồi bắt đầu ngay các phiên tập trung Pomodoro trên cùng một công cụ. Nó giúp mình duy trì dòng tập trung mà không bị phân tâm bởi hàng tá tab trình duyệt.'
        : 'I love how I can transition from looking at our team goals down to doing Pomodoro focus blocks in the same tool. It keeps me in the zone without distracting browser tabs.',
    },
    {
      name: 'Sophia Gallagher',
      role: isVi ? 'Giám đốc Sáng tạo' : 'Creative Director',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
      text: isVi
        ? 'Chronelis đã loại bỏ hoàn toàn những thứ rườm rà của các trình quản lý công việc truyền thống. Mình chỉ mất chưa đầy năm phút để thiết lập không gian làm việc cho các dự án freelance của mình, và việc kéo thả trên Kanban thực sự mang lại niềm vui.'
        : 'Chronelis does away with all the clutter of traditional task managers. Setting up workspaces for my freelance projects took less than five minutes, and the drag-and-drop Kanban is pure joy.',
    },
  ]

  const [loadWebGL, setLoadWebGL] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true)
      } else {
        setShowScrollTop(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    
    // Delay loading WebGL bends to ensure instant FCP and LCP scores in Lighthouse
    const webGlTimer = setTimeout(() => setLoadWebGL(true), 600)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(webGlTimer)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleLogout = () => {
    clearSession()
    toast.success(t('common.toast.logoutSuccess'))
    setLogoutConfirmOpen(false)
    navigate('/login')
  }

  return (
    <>
      <div className="relative min-h-screen w-full bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden transition-colors duration-300">
      {/* Background Animation - Hero Section Only */}
      <div className="absolute top-0 left-0 right-0 h-[100vh] z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          {loadWebGL && (
            <ColorBends
              colors={['#ff5c7a', '#8a5cff', '#00ffd1']}
              rotation={90}
              speed={0.2}
              scale={1.2}
              frequency={1}
              warpStrength={1}
              mouseInfluence={1}
              noise={0.15}
              parallax={0.5}
              iterations={1}
              intensity={1}
              bandWidth={6}
              transparent
              autoRotate={0}
            />
          )}
        </div>
        {/* Dynamic overlay to ensure text is always readable without completely hiding the background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background dark:from-transparent dark:via-background/70 dark:to-background" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 bg-background/50 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center relative h-10 w-32">
            <img
              src={logoSrc}
              alt="Chronelis"
              className={`h-28 w-auto absolute top-1/2 left-0 -translate-y-1/2 drop-shadow-sm pointer-events-none max-w-none origin-left transition-all duration-300 ${theme === 'dark' ? 'scale-[0.78]' : ''}`}
            />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              {isVi ? 'Tính năng' : 'Features'}
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              {isVi ? 'Hoạt động' : 'How it Works'}
            </a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">
              {isVi ? 'Khách hàng' : 'Testimonials'}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeLanguageToggle />
            {currentUser ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted dark:hover:bg-muted/75">
                    <Avatar className="size-7">
                      {currentUser.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.firstName} />}
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {currentUser.firstName?.charAt(0)}
                        {currentUser.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium md:inline-block">{currentUser.firstName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="w-full flex items-center">
                      <Layout className="mr-2 size-4" />
                      {isVi ? 'Bảng điều khiển' : 'Dashboard'}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="w-full flex items-center">
                      <User className="mr-2 size-4" />
                      {isVi ? 'Hồ sơ' : 'Profile'}
                    </Link>
                  </DropdownMenuItem>
                  {canAccessAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate('/admin/users')}
                      className="bg-amber-50 font-semibold text-amber-900 hover:bg-amber-100 focus:bg-amber-100 focus:text-amber-900 dark:bg-amber-100/10 dark:text-amber-400 dark:hover:bg-amber-100/20 cursor-pointer"
                    >
                      <ShieldCheck className="mr-2 size-4" />
                      {isVi ? 'Khu quản trị' : 'Admin dashboard'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      window.setTimeout(() => setLogoutConfirmOpen(true), 0)
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" />
                    {isVi ? 'Đăng xuất' : 'Log out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                >
                  {isVi ? 'Đăng nhập' : 'Log in'}
                </Link>
                <Button size="sm" asChild className="rounded-full font-semibold">
                  <Link to="/register">{isVi ? 'Bắt đầu ngay' : 'Get Started'}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 text-center">
          <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-border/50 text-xs font-medium text-primary mb-4 backdrop-blur-md shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              {isVi ? 'Chronelis 2.0 đã chính thức ra mắt' : 'Chronelis 2.0 is now live'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-sm leading-[1.15] text-foreground">
              {isVi ? (
                <>
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent block pb-3 pt-1 px-1">
                    Hợp nhất dự án & mục tiêu
                  </span>
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent block pb-3 pt-1 px-1">
                    Bứt phá mọi giới hạn
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent block pb-3 pt-1 px-1">
                    Unify projects & goals
                  </span>
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent block pb-3 pt-1 px-1">
                    Unleash your focus
                  </span>
                </>
              )}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl font-light leading-relaxed">
              {isVi
                ? 'Không gian làm việc cộng tác mượt mà. Quản lý mục tiêu, nhiệm vụ và phiên tập trung Pomodoro với dữ liệu đồng bộ tức thì trên giao diện Kanban, Danh sách và Lịch.'
                : 'A beautiful, unified workspace designed for seamless collaboration. Manage your goals, tasks, and Pomodoro sessions with real-time sync across Kanban, List, and Calendar views.'}
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                asChild
                className="rounded-full shadow-lg shadow-primary/10 transition-all hover:scale-105 px-8 h-12 text-sm font-semibold group flex items-center justify-center"
              >
                <Link to="/register">
                  {isVi ? 'Bắt đầu miễn phí' : 'Start for free'}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-full border border-border/60 bg-background/50 backdrop-blur-md transition-all hover:scale-105 px-8 h-12 text-sm font-semibold flex items-center justify-center"
              >
                <a href="#features">{isVi ? 'Tìm hiểu thêm' : 'Learn more'}</a>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                {
                  vi: '100% Miễn phí',
                  en: '100% Free',
                  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                },
                {
                  vi: 'Cộng tác theo thời gian thực',
                  en: 'Real-time Collaboration',
                  color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                },
                {
                  vi: 'Không giới hạn dự án',
                  en: 'Unlimited Projects',
                  color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                },
              ].map((badge, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-medium backdrop-blur-sm shadow-sm transition-all duration-300 hover:scale-105 ${badge.color}`}
                >
                  {isVi ? badge.vi : badge.en}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 px-6 bg-background border-t border-border/40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20 flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-bold tracking-tight mb-6 max-w-[90vw]">
                <TrueFocus
                  sentence={isVi ? 'Tập trung vào điều quan trọng nhất' : 'True focus on what matters'}
                  manualMode={false}
                  blurAmount={5}
                  borderColor="var(--primary)"
                  animationDuration={0.5}
                  pauseBetweenAnimations={1}
                />
              </div>
              <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mt-4">
                {isVi
                  ? 'Chronelis gom luồng công việc, nhiệm vụ và trao đổi nhóm vào một không gian thống nhất, dễ nhìn.'
                  : 'Chronelis brings all your workflows, tasks, and team communications into one unified, beautiful workspace.'}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Zap className="h-8 w-8 text-yellow-500" />,
                  title: isVi ? 'Tốc độ chớp nhoáng' : 'Lightning Fast',
                  desc: isVi
                    ? 'Xây dựng trên kiến trúc hiện đại đảm bảo mọi tương tác đều tức thì. Công việc của bạn không bao giờ bị gián đoạn.'
                    : 'Built on modern architecture to ensure every interaction is instant. Your workflow will never be interrupted by loading states.',
                },
                {
                  icon: <Layout className="h-8 w-8 text-primary" />,
                  title: isVi ? 'Giao diện đa dạng' : 'Beautiful Views',
                  desc: isVi
                    ? 'Trực quan hóa công việc theo cách bạn muốn. Chuyển đổi liền mạch giữa Kanban, List, Calendar và Timeline.'
                    : 'Visualize your work exactly how you want. Switch seamlessly between Kanban, List, Calendar, and Timeline views.',
                },
                {
                  icon: <Users className="h-8 w-8 text-blue-500" />,
                  title: isVi ? 'Cộng tác mượt mà' : 'Seamless Collaboration',
                  desc: isVi
                    ? 'Cập nhật theo thời gian thực, bình luận trực tiếp và thông báo thông minh giúp cả đội ngũ luôn đồng bộ.'
                    : 'Real-time updates, inline commenting, and smart notifications keep your entire team aligned and moving forward.',
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
                >
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Preview Section */}
        {/* Dashboard Preview Section */}
        <section id="how-it-works" className="py-24 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                {isVi ? 'Giao diện hiện đại, dễ sử dụng' : 'Modern, intuitive interface'}
              </h2>
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden ring-1 ring-border/50">
              {/* Fake Mac Window Header */}
              <div className="h-12 border-b border-border flex items-center px-4 gap-2 bg-muted/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
              </div>

              {/* Fake UI Body */}
              <div className="flex h-[550px] bg-background">
                {/* Sidebar */}
                <div className="hidden md:flex w-64 flex-col gap-2 border-r border-border p-4 bg-card/50">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-primary bg-primary/10 rounded-md mb-4">
                    <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      C
                    </div>
                    Chronelis Team
                  </div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2">
                    <Layout className="w-4 h-4 text-muted-foreground" /> {isVi ? 'Bảng công việc' : 'Boards'}
                  </div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {isVi ? 'Nhiệm vụ của tôi' : 'My Tasks'}
                  </div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" /> {isVi ? 'Thành viên' : 'Members'}
                  </div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2">
                    <Star className="w-4 h-4 text-muted-foreground" /> {isVi ? 'Mục yêu thích' : 'Favorites'}
                  </div>
                  <div className="mt-auto pt-4 border-t border-border/50">
                    <Button className="w-full justify-center text-sm font-medium" variant="default">
                      + {isVi ? 'Tạo dự án mới' : 'New Project'}
                    </Button>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div className="h-10 px-4 bg-muted/50 rounded-lg flex items-center border border-border/50">
                      <span className="text-lg font-bold">
                        {isVi ? 'Dự án Q3 - Phát triển ứng dụng' : 'Q3 Project - Mobile App'}
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
                        alt="Member 1"
                        className="w-8 h-8 rounded-full border-2 border-background object-cover"
                        loading="lazy"
                      />
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                        alt="Member 2"
                        className="w-8 h-8 rounded-full border-2 border-background object-cover"
                        loading="lazy"
                      />
                      <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary">
                        +3
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    {kanbanCols.map((col, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border ${col.bg.replace('/10', '/20')} p-4 flex flex-col gap-3 bg-card/50`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div
                            className={`px-2.5 py-1 text-xs font-bold ${col.bg} ${col.border} rounded-md flex items-center gap-2`}
                          >
                            {col.title} <span className="opacity-50">{col.count}</span>
                          </div>
                          <div className="font-bold text-muted-foreground tracking-widest cursor-pointer hover:text-foreground">
                            ...
                          </div>
                        </div>

                        {col.items.map((item, j) => (
                          <div
                            key={j}
                            className="p-4 bg-background rounded-lg border border-border shadow-sm flex flex-col gap-3 group hover:border-primary/50 transition-colors cursor-grab"
                          >
                            <div className="text-sm font-medium leading-tight">{item.title}</div>
                            <div className="flex gap-1.5 flex-wrap">
                              {item.tags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${item.tagColors[tIdx]}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {item.subtasks}
                              </div>
                              <img
                                src={item.avatar}
                                alt="JD"
                                className="h-6 w-6 rounded-full object-cover border border-border/50"
                                loading="lazy"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-32 px-6 bg-background border-t border-border/40 overflow-hidden">
          <div className="max-w-7xl mx-auto mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {isVi ? 'Được yêu thích bởi các đội ngũ hiện đại' : 'Loved by modern teams'}
            </h2>
          </div>

          <div className="relative w-full overflow-hidden py-4">
            {/* Fade-out masks */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background via-background/80 to-transparent z-10" />

            <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused] w-max">
              {/* First list copy */}
              <div className="flex gap-6 shrink-0">
                {testimonials.map((t, idx) => (
                  <div
                    key={`t1-${idx}`}
                    className="w-[320px] md:w-[380px] shrink-0 p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col justify-between whitespace-normal"
                  >
                    <div>
                      <div className="flex gap-1 mb-6 text-yellow-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <p className="text-muted-foreground mb-8 leading-relaxed text-sm md:text-base">"{t.text}"</p>
                    </div>
                    <div className="flex items-center gap-4 border-t border-border/40 pt-4 mt-auto">
                      <img
                        src={t.avatar}
                        alt={t.name}
                        className="w-11 h-11 rounded-full object-cover border border-border/50 animate-in fade-in zoom-in duration-300"
                        loading="lazy"
                      />
                      <div>
                        <div className="font-bold text-sm text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Second list copy for seamless looping */}
              <div className="flex gap-6 shrink-0" aria-hidden="true">
                {testimonials.map((t, idx) => (
                  <div
                    key={`t2-${idx}`}
                    className="w-[320px] md:w-[380px] shrink-0 p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col justify-between whitespace-normal"
                  >
                    <div>
                      <div className="flex gap-1 mb-6 text-yellow-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <p className="text-muted-foreground mb-8 leading-relaxed text-sm md:text-base">"{t.text}"</p>
                    </div>
                    <div className="flex items-center gap-4 border-t border-border/40 pt-4 mt-auto">
                      <img
                        src={t.avatar}
                        alt={t.name}
                        className="w-11 h-11 rounded-full object-cover border border-border/50 animate-in fade-in zoom-in duration-300"
                        loading="lazy"
                      />
                      <div>
                        <div className="font-bold text-sm text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-card pt-20 pb-10 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center mb-6 relative h-9 w-32">
                <img
                  src={logoSrc}
                  alt="Chronelis"
                  className={`h-28 w-auto absolute top-1/2 left-0 -translate-y-1/2 pointer-events-none max-w-none origin-left transition-all duration-300 ${theme === 'dark' ? 'scale-[0.78]' : ''}`}
                />
              </div>
              <p className="text-muted-foreground max-w-xs mb-6">
                {isVi
                  ? 'Giúp nhóm quản lý dự án, mục tiêu, công việc và thời gian tập trung trong một không gian rõ ràng.'
                  : 'Building the future of team collaboration and project management, one beautiful component at a time.'}
              </p>
            </div>

            {marketingFooterGroups.map((group) => (
              <div key={group.title.en}>
                <h4 className="font-bold mb-4">{isVi ? group.title.vi : group.title.en}</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="hover:text-foreground transition-colors">
                        {isVi ? link.label.vi : link.label.en}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="max-w-7xl mx-auto pt-8 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 items-center text-sm text-muted-foreground">
            <p className="col-span-2 md:col-span-3 lg:col-span-4">
              © 2026 Chronelis Inc. {isVi ? 'Bản quyền thuộc về Chronelis.' : 'All rights reserved.'}
            </p>
            <div className="col-span-2 md:col-span-1 lg:col-span-1 flex items-center gap-4 justify-start">
              <a
                href="https://github.com/thuanfhu/Chronelis-frontend-reactjs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-300 text-xs font-semibold group"
                title={isVi ? 'Kho lưu trữ Frontend' : 'Frontend Repository'}
              >
                <i className="fa-brands fa-github text-base group-hover:scale-110 transition-transform duration-200" />
                <span>Frontend</span>
              </a>
              <a
                href="https://github.com/thuanfhu/Chronelis-backend-spring-boot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-300 text-xs font-semibold group"
                title={isVi ? 'Kho lưu trữ Backend' : 'Backend Repository'}
              >
                <i className="fa-brands fa-github text-base group-hover:scale-110 transition-transform duration-200" />
                <span>Backend</span>
              </a>
            </div>
          </div>
        </footer>

        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="icon"
            className="fixed bottom-6 right-6 z-50 rounded-full h-12 w-12 bg-background/60 hover:bg-primary hover:text-primary-foreground text-foreground backdrop-blur-md border border-border shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-primary/20 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-300"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
      </div>
      <ConfirmModal
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title={t('admin.sidebar.logoutTitle')}
        description={t('admin.sidebar.logoutDescription')}
        confirmText={t('common.logout')}
        confirmVariant="destructive"
        onConfirm={handleLogout}
      />
    </>
  )
}
