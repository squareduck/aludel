export type Partial<T> = { [P in keyof T]?: T[P] }

/*
 * Create template
 */

export type Template = {
    sockets: string[]
    actions: { [key: string]: Action }
    render: (RenderTools) => any
}

export type Action = (...args) => (model: any) => any

export function createTemplate(config: Partial<Template>): Template {
    return Object.assign(
        {
            sockets: [],
            actions: {},
            render: () => {},
        },
        config,
    )
}

/*
 * Create component
 */

export type Paths = { [key: string]: string[] }

export type Component = {
    template: Template
    paths: Paths
}

export function createComponent(template: Template, paths: Paths): Component {
    return {
        template,
        paths,
    }
}

/*
 * Create instance
 */

import { Context } from './context'

export type Instance = () => any

export function createInstance(
    context: Context,
    component: Component,
): Instance {
    return () => {
        return component.template.render({})
    }
}
