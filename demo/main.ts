import {
    createApp,
    createComponent,
    Model,
    ComponentTemplate,
    Component,
} from '../src/index'
import m from 'mithril'

import { layoutComponent } from './components/layout'
import { homeComponent } from './components/home'
import { mainComponent as childrenMainComponent } from './components/children/main'
import { mainComponent as subroutesMainComponent } from './components/subroutes/main'
import { personComponent as subroutePersonComponent } from './components/subroutes/person'
import { mainComponent as promisesComponent } from './components/promises/main'

const renderer = (rootElement: HTMLElement, component: any) => {
    m.render(rootElement, component())
}

const initialModel = {}

const app = createApp(renderer, initialModel)

const routes = {
    // '*': '/home',
    '/': {
        name: 'Home',
        component: homeComponent,
    },
    '/children': {
        name: 'Children',
        component: childrenMainComponent,
    },
    '/subroutes': {
        name: 'Subroutes',
        component: subroutesMainComponent,
        action: () => (model: Model) =>
            model.name ? model : model.set('name', 'Joe'),
        subroutes: {
            '/:name': {
                name: 'SubroutePersonOutlet',
                component: subroutePersonComponent,
                action: ({ name }) => (model: Model) =>
                    model.set('person', name),
            },
        },
    },
    '/subroutes/person/:name': {
        name: 'SubroutePerson',
        component: subroutePersonComponent,
        action: ({ name }) => (model: Model) => model.set('person', name),
    },
    '/promises': {
        name: 'Promises',
        component: promisesComponent,
        action: () =>
            fetch('https://jsonplaceholder.typicode.com/posts/1')
                .then((response) => response.json())
                .then((post) => (model: Model) => model.set('post', post)),
    },
    '/promises/:id': {
        name: 'PromisesId',
        component: promisesComponent,
        action: ({ id }) =>
            fetch('https://jsonplaceholder.typicode.com/posts/' + id)
                .then((response) => response.json())
                .then((post) => (model: Model) =>
                    model.set('post', post).setIn(['$local', 'loading'], false),
                ),
    },
}

const routerConfig = {
    routes: routes,
    rootPath: '/aludel',
    defaultPath: '/',
}

app(document.body, layoutComponent, routerConfig)
