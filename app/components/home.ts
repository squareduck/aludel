import m from 'mithril'
import { ComponentTemplate, ViewTools } from '../../src/main'
import { app } from '../app'
import { navigationCpt } from './navigation'

export const homeTpl: ComponentTemplate = {
    sockets: ['userList', 'currentUser'],
    actions: ({paths}) => ({
        '@init': () => (model) => {
            return model.setIn(['currentUser', 'name'], 'Duck')
        }
    }),
    view: ({model, navigate}) =>
        m('div', {class: 'home'}, [
            navigationCpt(),
            m('div', {class: 'main'}, [
                m('div', `Hello, ${model.currentUser.name}`)
            ])
        ])

}

export const homeCpt = app.createComponent(homeTpl, {
    userList: ['users', 'list'],
    currentUser: ['users', 'currentUser']
})
