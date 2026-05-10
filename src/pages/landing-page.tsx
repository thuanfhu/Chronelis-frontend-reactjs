import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ColorBends from '@/components/ColorBends';
import { CheckCircle2, Layout, Zap, Users, ArrowRight, Star } from 'lucide-react';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { useTranslation } from 'react-i18next';

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden transition-colors duration-300">
      {/* Background Animation - Hero Section Only */}
      <div className="absolute top-0 left-0 right-0 h-[100vh] z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          <ColorBends
            colors={["#ff5c7a", "#8a5cff", "#00ffd1"]}
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
            color="#A855F7"
          />
        </div>
        {/* Dynamic overlay to ensure text is always readable without completely hiding the background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background dark:from-transparent dark:via-background/70 dark:to-background" />
      </div>
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 bg-background/50 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">Chronelis</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{isVi ? "Tính năng" : "Features"}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{isVi ? "Hoạt động" : "How it Works"}</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">{isVi ? "Khách hàng" : "Testimonials"}</a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeLanguageToggle />
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              {isVi ? "Đăng nhập" : "Log in"}
            </Link>
            <Button size="sm" asChild className="rounded-full font-semibold">
              <Link to="/register">
                {isVi ? "Bắt đầu ngay" : "Get Started"}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10">
        
        {/* Hero Section */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 text-center">
          <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-border/50 text-xs font-medium text-primary mb-4 backdrop-blur-md shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              {isVi ? "Chronelis 2.0 đã chính thức ra mắt" : "Chronelis 2.0 is now live"}
            </div>
            <h1 className="bg-gradient-to-br from-foreground via-foreground/90 to-foreground/50 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl md:text-8xl drop-shadow-sm leading-[1.1]">
              {isVi ? <>Quản lý thời gian.<br/>Nâng tầm đội ngũ.</> : <>Master your time.<br/>Elevate your team.</>}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl md:text-2xl font-light leading-relaxed">
              {isVi 
                ? "Nền tảng quản lý công việc thông minh, đẹp mắt giúp các đội ngũ hiện đại vận hành nhanh hơn và cộng tác mượt mà hơn."
                : "The beautiful, intelligent task management platform designed to help modern teams ship faster and collaborate seamlessly."}
            </p>
            
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                asChild 
                className="rounded-full shadow-xl shadow-primary/20 transition-all hover:scale-105 px-8 h-14 text-lg font-medium group"
              >
                <Link to="/register">
                  {isVi ? "Bắt đầu miễn phí" : "Start for free"}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="rounded-full bg-background/50 backdrop-blur-md transition-all hover:scale-105 px-8 h-14 text-lg font-medium"
              >
                <Link to="/login">
                  {isVi ? "Đặt lịch demo" : "Book a demo"}
                </Link>
              </Button>
            </div>
            
            <p className="mt-6 text-sm text-muted-foreground/70">
              {isVi ? "Không cần thẻ tín dụng • Dùng thử 14 ngày • Hủy bất cứ lúc nào" : "No credit card required • Free 14-day trial • Cancel anytime"}
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 px-6 bg-background border-t border-border/40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                {isVi ? "Mọi thứ bạn cần để mở rộng" : "Everything you need to scale"}
              </h2>
              <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                {isVi ? "Chronelis mang tất cả luồng công việc, nhiệm vụ và giao tiếp nhóm vào một không gian thống nhất, đẹp mắt." : "Chronelis brings all your workflows, tasks, and team communications into one unified, beautiful workspace."}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Zap className="h-8 w-8 text-yellow-500" />,
                  title: isVi ? "Tốc độ chớp nhoáng" : "Lightning Fast",
                  desc: isVi ? "Xây dựng trên kiến trúc hiện đại đảm bảo mọi tương tác đều tức thì. Công việc của bạn không bao giờ bị gián đoạn." : "Built on modern architecture to ensure every interaction is instant. Your workflow will never be interrupted by loading states."
                },
                {
                  icon: <Layout className="h-8 w-8 text-primary" />,
                  title: isVi ? "Giao diện đa dạng" : "Beautiful Views",
                  desc: isVi ? "Trực quan hóa công việc theo cách bạn muốn. Chuyển đổi liền mạch giữa Kanban, List, Calendar và Timeline." : "Visualize your work exactly how you want. Switch seamlessly between Kanban, List, Calendar, and Timeline views."
                },
                {
                  icon: <Users className="h-8 w-8 text-blue-500" />,
                  title: isVi ? "Cộng tác mượt mà" : "Seamless Collaboration",
                  desc: isVi ? "Cập nhật realtime, bình luận trực tiếp và thông báo thông minh giúp cả đội ngũ luôn đồng bộ và tiến lên." : "Real-time updates, inline commenting, and smart notifications keep your entire team aligned and moving forward."
                }
              ].map((feature, i) => (
                <div key={i} className="p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all group">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
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
                {isVi ? "Giao diện hiện đại, dễ sử dụng" : "Modern, intuitive interface"}
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
                    <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">C</div>
                    Chronelis Team
                  </div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2"><Layout className="w-4 h-4 text-muted-foreground"/> {isVi ? "Bảng công việc" : "Boards"}</div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground"/> {isVi ? "Nhiệm vụ của tôi" : "My Tasks"}</div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground"/> {isVi ? "Thành viên" : "Members"}</div>
                  <div className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md flex items-center gap-2"><Star className="w-4 h-4 text-muted-foreground"/> {isVi ? "Mục yêu thích" : "Favorites"}</div>
                  <div className="mt-auto pt-4 border-t border-border/50">
                    <Button className="w-full justify-center text-sm font-medium" variant="default">
                       + {isVi ? "Tạo dự án mới" : "New Project"}
                    </Button>
                  </div>
                </div>
                
                {/* Main Content */}
                <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div className="h-10 px-4 bg-muted/50 rounded-lg flex items-center border border-border/50">
                      <span className="text-lg font-bold">{isVi ? "Dự án Q3 - Phát triển App" : "Q3 Project - Mobile App"}</span>
                    </div>
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/80 border-2 border-background"></div>
                      <div className="w-8 h-8 rounded-full bg-purple-500/80 border-2 border-background"></div>
                      <div className="w-8 h-8 rounded-full bg-green-500/80 border-2 border-background flex items-center justify-center text-[10px] font-bold text-white">+3</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    {[
                      { bg: "bg-red-500/10", border: "border-red-500/20", title: isVi ? "Cần làm" : "To Do", count: 3, items: [isVi ? "Thiết kế màn hình đăng nhập" : "Design Login Screen", isVi ? "Cập nhật API tài liệu" : "Update API Docs"] },
                      { bg: "bg-yellow-500/10", border: "border-yellow-500/20", title: isVi ? "Đang tiến hành" : "In Progress", count: 2, items: [isVi ? "Sửa lỗi thanh toán Stripe" : "Fix Stripe Payment Bug"] },
                      { bg: "bg-green-500/10", border: "border-green-500/20", title: isVi ? "Hoàn thành" : "Done", count: 5, items: [isVi ? "Review code PR #102" : "Review code PR #102", isVi ? "Họp kế hoạch tuần" : "Weekly Planning Meeting"] }
                    ].map((col, i) => (
                      <div key={i} className={`rounded-xl border ${col.border} p-4 flex flex-col gap-3 bg-card/50`}>
                        <div className="flex justify-between items-center mb-1">
                          <div className={`px-2.5 py-1 text-xs font-bold ${col.bg} rounded-md flex items-center gap-2`}>
                            {col.title} <span className="opacity-50">{col.count}</span>
                          </div>
                          <div className="font-bold text-muted-foreground tracking-widest cursor-pointer hover:text-foreground">...</div>
                        </div>
                        
                        {col.items.map((item, j) => (
                          <div key={j} className="p-4 bg-background rounded-lg border border-border shadow-sm flex flex-col gap-3 group hover:border-primary/50 transition-colors cursor-grab">
                            <div className="text-sm font-medium leading-tight">{item}</div>
                            <div className="flex gap-2">
                              <div className="h-1.5 w-8 rounded-full bg-primary/40"></div>
                              <div className="h-1.5 w-12 rounded-full bg-blue-500/40"></div>
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium"><CheckCircle2 className="w-3.5 h-3.5"/> 0/3</div>
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">JD</div>
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
        <section id="testimonials" className="py-32 px-6 bg-background border-t border-border/40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                {isVi ? "Được yêu thích bởi các đội ngũ hiện đại" : "Loved by modern teams"}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  name: "Sarah Jenkins", role: isVi ? "Quản lý sản phẩm" : "Product Manager", 
                  text: isVi ? "Chronelis đã thay đổi hoàn toàn cách đội kỹ thuật và thiết kế cộng tác. Giao diện tuyệt đẹp và tốc độ không thể sánh bằng." : "Chronelis completely transformed how our engineering and design teams collaborate. The interface is stunning and the speed is unmatched." 
                },
                { 
                  name: "David Chen", role: "CTO", 
                  text: isVi ? "Chúng tôi chuyển từ Jira sang và không bao giờ nhìn lại. Sự đơn giản ẩn chứa một động cơ mạnh mẽ xử lý các quy trình agile phức tạp một cách hoàn hảo." : "We migrated from Jira and never looked back. The simplicity hides a powerful engine that handles our complex agile workflows flawlessly." 
                },
                { 
                  name: "Elena Rodriguez", role: isVi ? "Trưởng nhóm Thiết kế" : "Lead Designer", 
                  text: isVi ? "Cuối cùng cũng có một công cụ vừa đẹp lại vừa hoạt động tốt. Sự tỉ mỉ trong UI làm cho việc dành hàng giờ trong Chronelis thực sự thú vị." : "Finally, a tool that looks as good as it works. The attention to detail in the UI makes spending hours in Chronelis actually enjoyable." 
                }
              ].map((t, i) => (
                <div key={i} className="p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 mb-6 text-yellow-500">
                    {[1,2,3,4,5].map(star => <Star key={star} className="w-4 h-4 fill-current" />)}
                  </div>
                  <p className="text-muted-foreground mb-8 leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden bg-background">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent"></div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {isVi ? "Sẵn sàng làm việc hiệu quả nhất?" : "Ready to do your best work?"}
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              {isVi 
                ? "Tham gia cùng hàng ngàn đội ngũ đã nâng cấp quy trình làm việc với Chronelis." 
                : "Join thousands of teams who have already upgraded their workflow with Chronelis."}
            </p>
            <Button 
              size="lg" 
              asChild 
              className="rounded-full shadow-xl shadow-primary/20 transition-all hover:scale-105 px-10 h-14 text-lg font-bold"
            >
              <Link to="/register">
                {isVi ? "Bắt đầu miễn phí" : "Get Started for Free"}
              </Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-card pt-20 pb-10 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                  C
                </div>
                <span className="text-xl font-bold tracking-tight">Chronelis</span>
              </div>
              <p className="text-muted-foreground max-w-xs mb-6">
                {isVi 
                  ? "Xây dựng tương lai của cộng tác nhóm và quản lý dự án, bắt đầu từ từng component tuyệt đẹp." 
                  : "Building the future of team collaboration and project management, one beautiful component at a time."}
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">{isVi ? "Sản phẩm" : "Product"}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Tính năng" : "Features"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Tích hợp" : "Integrations"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Bảng giá" : "Pricing"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Cập nhật" : "Changelog"}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">{isVi ? "Công ty" : "Company"}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Về chúng tôi" : "About Us"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Tuyển dụng" : "Careers"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Blog" : "Blog"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Liên hệ" : "Contact"}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">{isVi ? "Pháp lý" : "Legal"}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Chính sách bảo mật" : "Privacy Policy"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Điều khoản dịch vụ" : "Terms of Service"}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{isVi ? "Chính sách Cookie" : "Cookie Policy"}</a></li>
              </ul>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2026 Chronelis Inc. {isVi ? "Bản quyền thuộc về." : "All rights reserved."}</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
              <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="#" className="hover:text-foreground transition-colors">Discord</a>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
