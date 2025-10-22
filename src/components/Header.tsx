import { useState } from 'react';
import { Menu, X, User, LogOut, KeyRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/MIG-Logo2.jpg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { callFunction } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, profile, signOut, getDashboardRoute, token } = useAuth();
  const { toast } = useToast();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changing, setChanging] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token) {
      toast({ title: 'Session expired', description: 'Please sign in again to update your password.', variant: 'destructive' });
      return;
    }
    if (!newPwd.trim() || !currentPwd.trim()) {
      toast({ title: 'Missing fields', description: 'Enter your current and new password.', variant: 'destructive' });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Password mismatch', description: 'New password and confirmation do not match.', variant: 'destructive' });
      return;
    }
    setChanging(true);
    try {
      // Use anon Authorization while passing user token in x-gcae-auth header.
      // This avoids the gateway's JWT verification and lets our function verify the token itself.
      await callFunction('auth-change-password', { oldPassword: currentPwd, newPassword: newPwd }, { token });
      toast({ title: 'Password updated', description: 'Your password was changed successfully.' });
      setPwdOpen(false);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message ?? 'Unable to change password.', variant: 'destructive' });
    } finally {
      setChanging(false);
    }
  };

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'About Us', href: '/about' },
    { name: 'Departments', href: '/departments' },
    { name: 'Projects', href: '/projects' },
    { name: 'Careers', href: '/careers' },
    { name: 'News', href: '/news' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="bg-card border-b border-card-border sticky top-0 z-50 shadow-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src={logo} 
              alt="GCAE Logo" 
              className="h-12 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold text-primary">GCAE</span>
              <span className="text-xs text-muted-foreground">A MIDROC Company</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.href)
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Authentication Section */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-4">
                    <User size={16} className="mr-2" />
                    {profile?.full_name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-medium">{profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {profile?.role?.replace('_', ' ')}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPwdOpen(true)}>
                    <KeyRound size={16} className="mr-2" />
                    Update Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {profile?.role === 'client' ? (
                    <DropdownMenuItem onClick={() => navigate('/client-portal')}>
                      <User size={16} className="mr-2" />
                      My Portal
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => navigate(getDashboardRoute())}>
                      <User size={16} className="mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setConfirmSignOut(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                className="ml-4"
                onClick={() => navigate('/auth/login')}
              >
                Portal Login
              </Button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-card-border">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`text-sm font-medium py-2 px-4 rounded transition-colors ${
                    isActive(item.href)
                      ? 'text-primary bg-secondary'
                      : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {isAuthenticated ? (
                <div className="mx-4 mt-4 pt-4 border-t border-card-border">
                  <div className="mb-3">
                    <p className="font-medium text-foreground">{profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile?.role?.replace('_', ' ')}
                    </p>
                  </div>
                 <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => { setPwdOpen(true); setIsMenuOpen(false); }}
                    >
                      <KeyRound size={16} className="mr-2" />
                      Update Password
                    </Button>
                    {profile?.role === 'client' ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => {
                          navigate('/client-portal');
                          setIsMenuOpen(false);
                        }}
                      >
                        <User size={16} className="mr-2" />
                        My Portal
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => {
                          navigate(getDashboardRoute());
                          setIsMenuOpen(false);
                        }}
                      >
                        <User size={16} className="mr-2" />
                        Dashboard
                      </Button>
                    )}
                    <Button
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setConfirmSignOut(true);
                      }}
                    >
                      <LogOut size={16} className="mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="default" 
                  size="sm" 
                  className="mx-4 mt-2"
                  onClick={() => {
                    navigate('/auth/login');
                    setIsMenuOpen(false);
                  }}
                >
                  Portal Login
                </Button>
              )}
            </nav>
          </div>
        )}
      </div>
      {/* Update Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
            <DialogDescription>Change your account password.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? ''} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
            </div>
            <div className="pt-2">
              <Button type="submit" disabled={changing} className="w-full">
                {changing ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign Out Confirmation */}
      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>This will end your current session.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => {
                setConfirmSignOut(false);
                void signOut();
              }}
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};

export default Header;