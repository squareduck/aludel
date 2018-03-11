import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
    Model,
} from '../../../src/index'

function randomId() {
    const max = 5
    return Math.floor(Math.random() * Math.floor(max))
}

const mainTemplate = createTemplate({
    sockets: ['post'],
    actions: {
        load: () =>
            fetch(`https://jsonplaceholder.typicode.com/posts/${randomId()}`)
                .then((response) => {
                    if (!response.ok) throw `Fetch failed with status ${response.status}`
                    return response.json()
                })
                .then((json) => (model: Model) => model.set('post', json))
                .catch((error) => (model: Model) =>
                    model.set('post', { title: error }),
                ),
    },
    render: ({ model, actions }) => {
        const post = model.post || {}
        return [
            m('h1', 'Promises'),
            m(
                'span',
                'Insead of "(model) => model" function action can return a Promise of that function.',
            ),
            m('span', 'This demo fetches a post during routing action.'),
            m('span', 'But also can load a random post if you click a button.'),
            m('span', 'There is a 20% chance that fetch will fail.'),
            m('br'),
            m('span', 'Navigate to /promises/:id URL to load a post with particular id.')
            m('br'),
            m('button', { onclick: actions.load }, 'Load random post'),
            m('br'),
            m('h2', post.title),
            m('span', `(id: ${post.id})`),
            m('span', post.body),
        ]
    },
})

export const mainComponent = createComponent(
    mainTemplate,
    {
        post: ['promises', 'post'],
    },
    'Promises Main',
)
