import { AuthForm } from '../../components/AuthForm';

export default function SignUpPage() {
  return (
    <main className="auth-wrap">
      <div className="span-7" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <p className="display" aria-hidden="true">
          Phantasma
        </p>
        <p className="muted" style={{ maxWidth: '36ch', fontSize: 17 }}>
          Every account starts with free generation credits. No API keys to paste.
        </p>
      </div>
      <AuthForm mode="sign-up" />
    </main>
  );
}
