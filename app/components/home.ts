import m from 'mithril'
import { ComponentTemplate } from '../../src/main'

export const homeTpl: ComponentTemplate = {
    sockets: ['userList', 'currentUser'],
    actions: ({paths}) => ({
        '@init': (model) => {
            return model.setIn(['currentUser', 'name'], 'Duck')
        }
    }),
    view: ({createComponent, model, navigate}) => {
        return [
            m('div', {class: 'header'}, 'Home'),
            m('div', {class: 'main'}, [
                m('div', `Hello, ${model.currentUser.name}`)
            ])
        ]
    }
}
