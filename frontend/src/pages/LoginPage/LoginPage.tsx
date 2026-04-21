import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import api from '../../api/client';
import './LoginPage.css';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resetToken = searchParams.get('resetToken') || '';
  const redirect = searchParams.get('redirect') || '/';
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    fullName: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isSubmittingAux, setIsSubmittingAux] = useState(false);
  const { login, register, isLoading } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const stripWhitespace = (value: string) => value.replace(/\s+/g, '');

  useEffect(() => {
    setMode(resetToken ? 'reset' : 'login');
    setError('');
    const persistedNotice = localStorage.getItem('nurfia_auth_notice') || '';
    if (persistedNotice) {
      setAuthNotice(persistedNotice);
      setInfoMessage('');
      localStorage.removeItem('nurfia_auth_notice');
      return;
    }

    setAuthNotice('');
    setInfoMessage('');
  }, [resetToken]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setInfoMessage('');
    setAuthNotice('');
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowRegisterConfirmPassword(false);
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);

    if (searchParams.has('resetToken') && nextMode !== 'reset') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('resetToken');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'forgot') {
      if (!form.email.trim()) {
        setError('Email is required.');
        return;
      }

      setIsSubmittingAux(true);
      try {
        const { data } = await api.post('/auth/forgot-password', { email: form.email.trim() });
        setInfoMessage(data.data?.message || 'Reset instructions have been sent if the email exists.');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to request password reset.');
      } finally {
        setIsSubmittingAux(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!resetToken) {
        setError('Reset token is missing.');
        return;
      }
      if (form.newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (/\s/.test(form.newPassword)) {
        setError('New password cannot contain spaces.');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError('Password confirmation does not match.');
        return;
      }

      setIsSubmittingAux(true);
      try {
        const { data } = await api.post('/auth/reset-password', {
          token: resetToken,
          newPassword: form.newPassword,
        });
        addToast('Password reset successfully. Please sign in again.', 'success');
        setInfoMessage(data.data?.message || 'Password reset successfully.');
        update('newPassword', '');
        update('confirmPassword', '');
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('resetToken');
        setSearchParams(nextParams, { replace: true });
        setMode('login');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to reset password.');
      } finally {
        setIsSubmittingAux(false);
      }
      return;
    }

    if (!form.username.trim() || (mode === 'register' && (!form.fullName.trim() || !form.email.trim()))) {
      setError('Required fields cannot be empty.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && /\s/.test(form.password)) {
      setError('Password cannot contain spaces.');
      return;
    }

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    try {
      if (mode === 'login') {
        await login(form.username, form.password);
        addToast('Welcome back!', 'success');
        const currentUser = useAuthStore.getState().user;
        const target = redirect && redirect !== '/'
          ? redirect
          : (currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF' || currentUser?.role === 'MANAGER' ? '/admin' : '/');
        navigate(target);
        return;
      }

      await register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        fullName: form.fullName.trim(),
      });
      addToast('Account created successfully!', 'success');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    }
  };

  const submitLabel = mode === 'login'
    ? 'Sign In'
    : mode === 'register'
      ? 'Create Account'
      : mode === 'forgot'
        ? 'Send Reset Link'
        : 'Reset Password';

  const busy = isLoading || isSubmittingAux;

  return (
    <div className="login-page">
      <div className="container">
        <div className="login-wrapper">
          <div className="login-card">
            <h1 className="login-title">
              {mode === 'login' && 'Sign In'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Forgot Password'}
              {mode === 'reset' && 'Set New Password'}
            </h1>
            <p className="login-subtitle">
              {mode === 'login' && 'Welcome back. Enter your credentials to access your account.'}
              {mode === 'register' && 'Join Nurfia for exclusive access to new arrivals, sales, and more.'}
              {mode === 'forgot' && 'Enter your email and we will send you a reset link.'}
              {mode === 'reset' && 'Choose a new password for your account.'}
            </p>

            {error && <div className="login-error">{error}</div>}
            {authNotice && <div className="login-warning">{authNotice}</div>}
            {infoMessage && <div className="login-info">{infoMessage}</div>}

            <form onSubmit={handleSubmit}>
              {mode === 'login' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-username">Username / Email</label>
                    <input id="login-username" className="form-input" type="text" value={form.username} onChange={(e) => update('username', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <div className="password-field-wrap">
                      <input
                        id="password"
                        className="form-input password-field-input"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                      >
                        {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="login-text-btn" onClick={() => switchMode('forgot')}>
                    Forgot your password?
                  </button>
                </>
              )}

              {mode === 'register' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-username">Username</label>
                      <input id="reg-username" className="form-input" type="text" value={form.username} onChange={(e) => update('username', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-fullname">Full Name</label>
                      <input id="reg-fullname" className="form-input" type="text" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">Email Address</label>
                    <input id="reg-email" className="form-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">Password</label>
                    <div className="password-field-wrap">
                      <input
                        id="reg-password"
                        className="form-input password-field-input"
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => update('password', stripWhitespace(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === ' ') {
                            e.preventDefault();
                          }
                        }}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                        title={showRegisterPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowRegisterPassword((prev) => !prev)}
                      >
                        {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm-password">Confirm Password</label>
                    <div className="password-field-wrap">
                      <input
                        id="reg-confirm-password"
                        className="form-input password-field-input"
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(e) => update('confirmPassword', stripWhitespace(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === ' ') {
                            e.preventDefault();
                          }
                        }}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        aria-label={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                      >
                        {showRegisterConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {mode === 'forgot' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email Address</label>
                  <input id="forgot-email" className="form-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-password">New Password</label>
                    <div className="password-field-wrap">
                      <input
                        id="reset-password"
                        className="form-input password-field-input"
                        type={showResetNewPassword ? 'text' : 'password'}
                        value={form.newPassword}
                        onChange={(e) => update('newPassword', stripWhitespace(e.target.value))}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        aria-label={showResetNewPassword ? 'Hide password' : 'Show password'}
                        title={showResetNewPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowResetNewPassword((prev) => !prev)}
                      >
                        {showResetNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-confirm-password">Confirm Password</label>
                    <div className="password-field-wrap">
                      <input
                        id="reset-confirm-password"
                        className="form-input password-field-input"
                        type={showResetConfirmPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(e) => update('confirmPassword', stripWhitespace(e.target.value))}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        aria-label={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                      >
                        {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary login-submit-btn" disabled={busy}>
                {busy ? 'Please wait...' : submitLabel}
              </button>
            </form>

            <div className="login-switch">
              {mode === 'login' && (
                <p>Don't have an account? <button type="button" onClick={() => switchMode('register')}>Create one</button></p>
              )}
              {mode === 'register' && (
                <p>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></p>
              )}
              {mode === 'forgot' && (
                <p>Remembered your password? <button type="button" onClick={() => switchMode('login')}>Back to sign in</button></p>
              )}
              {mode === 'reset' && (
                <p>Need a different reset link? <button type="button" onClick={() => switchMode('forgot')}>Request a new one</button></p>
              )}
            </div>
          </div>

          <div className="login-side">
            <div className="login-side-content">
              <h2>Nurfia</h2>
              <p>Premium Fashion for Women & Men</p>
              <div className="login-features">
                <div className="login-feature">Exclusive Collections</div>
                <div className="login-feature">Free Shipping on $500+</div>
                <div className="login-feature">30-Day Easy Returns</div>
                <div className="login-feature">Members-Only Discounts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
