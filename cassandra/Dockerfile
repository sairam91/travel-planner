# Cassandra with password authentication enabled.
# The official cassandra:5 image exposes no env var for the authenticator,
# so patch cassandra.yaml at build time. With PasswordAuthenticator, the node
# bootstraps a default superuser (cassandra / cassandra) on first start —
# rotate it and create an app role after the first boot.
FROM cassandra:5
RUN sed -ri 's/^authenticator:.*/authenticator: PasswordAuthenticator/' /etc/cassandra/cassandra.yaml && \
    sed -ri 's/^authorizer:.*/authorizer: CassandraAuthorizer/'       /etc/cassandra/cassandra.yaml
