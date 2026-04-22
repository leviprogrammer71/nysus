import { LoginForm } from "./login-form";
import { Logomark } from "@/app/components/logomark";

export const metadata = {
  title: "Sign in · Nysus",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logomark size={96} priority className="animate-paper-breath" />
          <h1 className="font-display text-4xl tracking-[0.2em] text-ink">
            NYSUS
          </h1>
          <p className="font-hand text-lg text-ink-soft">
            sign in to the <span className="highlight">notebook</span>
          </p>
        </header>

        <div className="w-full rule-ink" />

        <LoginForm />

        <footer className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-ink-soft/60 font-body">
          <span className="inline-block w-6 h-px bg-ink/30" />
          <span>after Dionysus</span>
          <span className="inline-block w-6 h-px bg-ink/30" />
        </footer>
      </div>
    </main>
  );
}
