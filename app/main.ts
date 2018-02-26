import { app } from './app'
import { homeCpt } from './components/home'
import { tasksCpt } from './components/tasks'
import { notesCpt } from './components/notes'


const router = app.createRouter({
    '/': {name: 'Home', component: homeCpt},
    '/tasks': {name: 'Tasks', component: tasksCpt},
    '/notes': {name: 'Notes', component: notesCpt, subroutes: {
        '/:id': {name: 'Note', actions: }
    }},
})

router.defaultRoute = 'Home'

const appElement = document.querySelector('.app')

if (appElement) app.start(<HTMLElement>appElement, router)
