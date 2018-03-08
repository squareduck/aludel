import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
    Model,
} from '../../../src/index'

const itemTemplate = createTemplate({
    sockets: ['items'],
    actions: {
        modify: (id) => (model: Model) => {
            const items = model.items.map(item => {
                if (item.id === id) return item.set('name', item.name + '@')
                return item
            })
            return model.set('items', items)
        }
    },
    render: ({props, model, actions}) => {
        return m('div', {onclick: () => actions.modify(props.id)}, `${props.id} - ${props.name}`)
    }
})

export const itemComponent = createComponent(itemTemplate, {
    items: ['children', 'items']
}, 'childrenItem')
