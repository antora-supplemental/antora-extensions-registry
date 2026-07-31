import { Navigate } from '@solidjs/router';

export default function LoginRedirect() {
  return <Navigate href="/auth/signin" />;
}
