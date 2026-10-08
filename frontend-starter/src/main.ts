import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideHttpClient, withInterceptors, withXhr } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { AppComponent } from './app/components/app/app';
import { routes } from './app/routes';
import { authInterceptor } from './app/shared/interceptors/auth.interceptor';
import { FrenchPaginatorIntl } from './app/shared/i18n/french-paginator-intl';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // withXhr() : depuis Angular 22, HttpClient utilise fetch par défaut, et
    // fetch ne sait pas suivre la progression d'un envoi (Mission 6, TP3).
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: MatPaginatorIntl, useClass: FrenchPaginatorIntl },
  ],
}).catch(console.error);
