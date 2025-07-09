; GraphQL injection for any template string following /* GraphQL */ comment
((comment) @_comment
 . (template_string) @injection.content
 (#eq? @_comment "/* GraphQL */")
 (#offset! @injection.content 0 1 0 -1)
 (#set! injection.include-children)
 (#set! injection.language "graphql")) 