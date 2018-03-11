import m from 'mithril'
import Immutable from 'seamless-immutable'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
    Model,
} from '../../../src/index'

import { itemComponent } from './item'

const mainTemplate = createTemplate({
    sockets: ['items'],
    actions: {
        '@init': () => (model: Model) => {
            const items = []
            for (let i = 0; i < 10; i++) {
                items.push({ id: i, name: `Item #${i}` })
            }
            return model.set('items', items)
        },

    },
    children: {
        item: itemComponent,
    },
    render: ({ model, child }) => {
        // const items = model.items || Immutable([])
        return [
            m('h1', 'Child components'),
            m('span', 'Child components must be declared in parent'),
            m('span', 'Items are created during /children route action'),
            m(
                'span',
                'Children components get item details as props (read only)',
            ),
            m('span', 'Click on an item to modify it'),
            m('br'),
            // TODO: Mithril can't handle result of immutable map in renderer
            m(
                'div.items',
                model.items
                    .asMutable()
                    .map((item) =>
                        child.item({ id: item.id, name: item.name }),
                    ),
            ),
        ]
    },
})

export const mainComponent = createComponent(
    mainTemplate,
    {
        items: ['children', 'items'],
    },
    'Children Main',
)
