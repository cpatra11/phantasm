import { AuthForm } from '../../components/AuthForm';

export default function SignInPage() {
  return (
    <main className="auth-wrap">
      <div className="span-7" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <p className="display" aria-hidden="true">
          Phantasma
        </p>
        <p className="muted" style={{ maxWidth: '36ch', fontSize: 17 }}>
          Turn a brand URL and a prompt into editable motion graphics, one scoped change at a time.
        </p>
      </div>
      <AuthForm mode="sign-in" />
    </main>
  );
}
