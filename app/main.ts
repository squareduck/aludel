import { app } from './app'
import { homeCpt } from './components/home'
import { tasksCpt } from './components/tasks'


const router = app.createRouter({
    '/': {name: 'Home', component: homeCpt},
    '/tasks': {name: 'Tasks', component: tasksCpt},
})

router.defaultRoute = 'Home'

const appElement = document.querySelector('.app')

if (appElement) app.start(<HTMLElement>appElement, router)
