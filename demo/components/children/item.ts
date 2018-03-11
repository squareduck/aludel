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
      // Find clicked item and modify it
      const items = model.items.map((item) => {
        if (item.id === id) return item.set('name', item.name + '@')
        return item
      })

      // Return updated model
      return model.set('items', items).set('$local', 'TEST')
    },
  },
  render: ({ props, model, actions }) => {
    return m(
      'div',
      { onclick: () => actions.modify(props.id) },
      `${props.id} - ${props.name}`,
    )
  },
})

export const itemComponent = createComponent(
  itemTemplate,
  {
    items: ['children', 'items'],
  },
  'Children Item',
)
