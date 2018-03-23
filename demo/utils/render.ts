import { h, VNode } from 'ultradom'

export function createLink(route, params, props, name, navigate, link) {
    props = Object.assign(props, {
        href: link[route](params),
        onclick: (e) => {
            e.preventDefault()
            navigate[route](params)
        }

    })
    return h('a', props, name)
}
