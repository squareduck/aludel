import m from 'mithril'
import {
  createTemplate,
  createComponent,
  Component,
  ComponentTemplate,
} from '../../src/index'

const homeTemplate = createTemplate({
  render: () => [
    m('h1', 'Aludel demo app'),
    m('span', 'Open your browser console to see when notable events happen'),
    m('br'),
    m('span', 'Choose demo:'),
    m('a', { href: '/#/children' }, 'Children components'),
    m('a', { href: '/#/subroutes' }, 'Subroutes'),
    m('a', { href: '/#/promises' }, 'Promises'),
  ],
})

export const homeComponent = createComponent(homeTemplate, {}, 'Home')
