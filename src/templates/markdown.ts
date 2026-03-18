export default `{# Reviewist: completed actions report #}
# {{ range.since }} to {{ range.until }}
{% for day in days %}

## {{ day.label }}
{% for action in day.actions %}
- {{ action.time }} {{ action.content }} ({{ action.project_name }}){% if action.count > 1 %} ×{{ action.count }}{% endif %}
{% endfor %}
{% endfor %}
`;
