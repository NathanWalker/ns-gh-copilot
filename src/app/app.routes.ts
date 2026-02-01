import { Routes } from '@angular/router';
import { AiChatComponent } from './ai-chat/ai-chat.component';
import { PersonComponent } from './people/person.component';
import { PersonDetailComponent } from './people/person-detail.component';

export const routes: Routes = [
  { path: '', redirectTo: '/chat', pathMatch: 'full' },
  { path: 'chat', component: AiChatComponent },
  { path: 'items', component: PersonComponent },
  { path: 'item/:id', component: PersonDetailComponent },
];
