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
        '@init': () => (model: Model) => {
            return model
                .setIn(['$local', 'loading'], false)
                .setIn(['post'], {})
        },
        load: () => [
            (model: Model) => model.setIn(['$local', 'loading'], true),
            fetch(`https://jsonplaceholder.typicode.com/posts/${randomId()}`)
                .then((response) => {
                    if (!response.ok)
                        throw `Fetch failed with status ${response.status}`
                    return response.json()
                })
                .then((json) => (model: Model) =>
                    model.set('post', json).setIn(['$local', 'loading'], false),
                )
                .catch((error) => (model: Model) =>
                    model
                        .set('post', { title: error })
                        .setIn(['$local', 'loading'], false),
                ),

        ]
    },
    render: ({ model, actions }) => {
        return [
            m('h1', 'Promises'),
            m(
                'span',
                'Insead of "(model) => model" function action can return a Promise of that function.',
            ),
            m('span', 'This demo fetches a post during routing action.'),
            m('span', 'But also can load a random post if you click a button.'),
            m(
                'span',
                'There is a 20% chance that fetch will fail (to show failure handling).',
            ),
            m('br'),
            m(
                'span',
                'Navigate to /promises/:id URL to load a post with particular id.',
            ),
            m('br'),
            m('button', { onclick: actions.load }, 'Load random post'),
            m('br'),
            m('h2', model.$local.loading ? 'Loading...' : model.post.title),
            m('span', `(id: ${model.post.id})`),
            m('span', model.post.body),
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
