import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideHttpClient, withInterceptors, withXhr } from "@angular/common/http";
import { provideRouter, TitleStrategy } from "@angular/router";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { MAT_ICON_DEFAULT_OPTIONS } from "@angular/material/icon";
import { AppComponent } from './app/components/app/app';
import { routes } from './app/routes';
import { authInterceptor } from './app/shared/interceptors/auth.interceptor';
import { FrenchPaginatorIntl } from './app/shared/i18n/french-paginator-intl';
import { CardVaultTitleStrategy } from './app/shared/utils/page-title';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // withXhr() : depuis Angular 22, HttpClient utilise fetch par défaut, et
    // fetch ne sait pas suivre la progression d'un envoi (Mission 6, TP3).
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: MatPaginatorIntl, useClass: FrenchPaginatorIntl },
    // Titre de l'onglet : « <page> · Card Vault » (V2, étape 8).
    { provide: TitleStrategy, useClass: CardVaultTitleStrategy },
    // index.html charge la police « Material Symbols Outlined » : on indique
    // à <mat-icon> d'utiliser sa classe CSS plutôt que « material-icons ».
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
}).catch(console.error);
