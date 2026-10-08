import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async signInWithGoogle(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/spendings';
      await this.router.navigateByUrl(returnUrl);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // Closing the popup is not an error worth showing
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.error.set((err as Error)?.message ?? 'Logowanie nie powiodło się.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
