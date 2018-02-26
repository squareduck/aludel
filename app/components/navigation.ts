import m from 'mithril'
import { ComponentTemplate, ViewTools} from '../../src/main'
import { app } from '../app'

const link = (href, nav, name, active) => m('a', {class: active ? 'active' : '', href, onclick: (e) => {e.preventDefault(); return nav()}}, name)

export const navigationTpl: ComponentTemplate = {
    sockets: ['currentRoute'],
    actions: () => ({}),
    view: ({model, navigate}) => {
        return [
            m('div', {class: 'header'}, [
                link('#/', navigate.Home, 'Home', model.currentRoute === 'Home'),
                link('#/tasks', navigate.Tasks, 'Tasks', model.currentRoute === 'Tasks' || model.currentRoute === 'Task')
                link('#/notes', navigate.Notes, 'Notes', model.currentRoute === 'Notes' || model.currentRoute === 'Note')
            ]),
        ]
    }
}

export const navigationCpt = app.createComponent(navigationTpl, {
    currentRoute: ['router', 'current'],
})
