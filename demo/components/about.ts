import { h } from 'ultradom'
import { createTemplate, createComponent, Component } from '../../src/index'

const h1 = (text) => h('h1', {}, text)
const h2 = (text) => h('h2', {}, text)
const h3 = (text) => h('h3', {}, text)
const p  = (text) => h('p', {}, text)
const code = (text) => h('code', {}, text)
const br = () => h('br', {})

const aboutTemplate = createTemplate({
    render: ({}) => {
        return h('div', { class: 'page about' }, [
            h('div', { class: 'content' }, [
                h1('What is Aludel'),
                p('Aludel aims to solve the Model part of Model → View relationship in most Virtual DOM inspired libraries. There is no doubt that "View is a pure function of Model" approach is working. But how exactly this Model should be implemented is up for a debate.'),
                p('Main design goal for Aludel is to define a strict protocol for reading and updating parts of global state and enforce it across all components.'),
                p('To achieve it Aludel lets you declare your components ahead of time, and instantiates them automatically as needed during runtime.'),
                p('You can use any Virtual DOM library (mithril, ultradom, snabbdom, etc). This website and examples below use ultradom.'),
                h1('Components'),
                p('Components have three stages: Template, Component and Instance. Let us take a closer look at each of them.'),
                h2('Template'),
                p('Defines component behavior in terms of Sockets, Actions and Render function.'),
                code(`
const template = createTemplate({
    sockets: ['counter'],
    actions: {
        increment: (amount) => (model) => {
            model.counter += amount
            return model
        }
    },
    render: ({model, action}) => {
        return h('div', {}, [
            h('h1', {}, model.counter),
            h('button', {onclick: () => action.increment(1)}, 'Increment')
        ])
    })
})
                    `),
                h3('Sockets'),
                p('Describe named placeholders for data that will later be populated with some parts of global state. Sockets populated with actual values represent the Local Model of component. It is available inside Actions and in Render function as "model".'),
                h3('Actions'),
                p('Describe actions available inside Render function. Each action must return a new version of Local Model. It will be synchronized back into global state. Actions can return a Promise of model if needed.'),
                p('Under the hood every local model returned from action is treated as promise (using Promise.resolve). That means we defer rendering at least until the next event loop tick. And by default Aludel does not guarantee global state immutability. If your actions mutates same references synchronously, next rendering will happen after all mutations are done. If this behavior is unwanted you should use some immutability library for your actions and/or global state (Immer looks like a good solution).'),
                h3('Render'),
                p('A View function that should return rendered value based on current Local Model of component. Render function has access to many useful tools, such as "model", "action", and routing tools.'),
                h2('Component'),
                p('Defines how each socket in Template should find its value in Global State. Having this separate step allows us to have components with identical templates, but ponting into different parts of Global State.'),
                code(`
const component = createComponent(template, {
    counter: ['data', 'counter']
})

const differentComponent = createComponent(template, {
    counter: ['backup', 'data', 'counter']
})
                    `),
                h2('Instance'),
                p('A "connected" version of component. Component by itself is just configuration. We need to give it meaning in context of some Global State. In example below we create new context and instantiate component with it. In most cases there is no need to write this code. Aludel will handle this part automatically when "createApp()" is used.'),
                code(`
const context = createContext({})
const intance = createInstance(context, component)
instance() // => VNode
                    `),
                h1('State'),
                h1('Context'),
                p('Context glues components together and makes sure their actions run against the same global state.'),
                p('It also keeps track of dependencies between components and reruns Component render function only when last action was initiated by dependent Component. Otherwise it just reuses last value returned from render function. We say that two components depend on each other when their paths intersect.'),
                h1('Application'),
                h1('Routing'),
            ]),
        ])
    },
})

export const aboutComponent = createComponent(aboutTemplate, {})
