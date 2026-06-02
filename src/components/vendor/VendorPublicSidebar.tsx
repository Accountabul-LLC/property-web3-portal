import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Store, MessageSquare, Heart, HelpCircle, LogOut, LogIn } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  title: string
  url?: string
  icon: typeof Store
  disabled?: boolean
  badge?: string
}

export function VendorPublicSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const items: NavItem[] = [
    { title: 'Directory', url: '/vendors', icon: Store },
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Messages', icon: MessageSquare, disabled: true, badge: 'Soon' },
    user
      ? { title: 'Favorites', url: '/portfolio', icon: Heart }
      : { title: 'Favorites', icon: Heart, disabled: true, badge: 'Sign in' },
  ]

  const isActive = (url?: string) => !!url && pathname === url

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold">Accountabul</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.disabled || !item.url ? (
                    <SidebarMenuButton disabled className="opacity-60">
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge ? (
                        <Badge variant="secondary" className="ml-auto h-5 text-[10px]">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="mailto:support@accountabul.com">
                <HelpCircle className="h-4 w-4" />
                <span>Help & Support</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {user ? (
              <SidebarMenuButton onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild>
                <Link to="/auth">
                  <LogIn className="h-4 w-4" />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default VendorPublicSidebar
