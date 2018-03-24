import hash from 'object-hash'
import { Context, Model, ConnectedActionMap } from './context'
import { NavigateMap, LinkMap } from './router'

export type Partial<T> = { [P in keyof T]?: T[P] }

/*
 * Create template
 */

export type Template = {
    sockets: string[]
    actions: ActionMap
    children: ComponentMap
    render: (tools: RenderTools) => any
}

export type RenderTools = {
    model: Model
    action: ConnectedActionMap
    child: InstanceMap
    props: Model
    outlet: Instance
    navigate: NavigateMap,
    link: LinkMap
}

export type Action = (...args) => (model: Model) => Model
export type ActionMap = { [key: string]: Action }

export function createTemplate(config: Partial<Template>): Template {
    return Object.assign(
        {
            sockets: [],
            actions: {},
            children: {},
            render: () => {},
        },
        config,
    )
}

/*
 * Create component
 */

export type PathMap = { [key: string]: (string | number)[] }

export type Component = {
    signature: string
    template: Template
    paths: PathMap
}

export type ComponentMap = { [key: string]: Component }

export function createComponent(template: Template, paths: PathMap): Component {
    // Check that we have same amount of paths and sockets
    const equalAmount = Object.keys(paths).length === template.sockets.length
    // Check that we have a path for each socket
    const allSocketsCovered =
        template.sockets.filter(
            socket => Object.keys(paths).indexOf(socket) < 0,
        ).length === 0

    // If either is false we throw error
    if (!equalAmount || !allSocketsCovered)
        throw new Error(`Paths and sockets don't match.`)

    return {
        template,
        paths,
        signature: hash({template, paths})
    }
}

/*
 * Create instance
 */

export type Instance = (props?: Model) => any
export type InstanceMap = { [key: string]: Instance }

export function createInstance(
    context: Context,
    component: Component,
    tools: {
        outlet: Instance
        navigate: NavigateMap
        link: LinkMap
    } = {
        outlet: () => {},
        navigate: {},
        link: {},
    },
): Instance {
    const child = Object.keys(component.template.children).reduce(
        (acc, name) => {
            acc[name] = createInstance(
                context,
                component.template.children[name],
            )
            return acc
        },
        {},
    )

    return (props: Model = {}) => {
        const model = context.localModel(component.paths)
        const action = context.connectActions(
            component.paths,
            component.template.actions,
        )

        return component.template.render({
            model,
            action,
            child,
            props,
            outlet: tools.outlet,
            navigate: tools.navigate,
            link: tools.link,
        })
    }
}
