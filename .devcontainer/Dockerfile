FROM node:lts

# Use a non-root user
RUN groupadd default && useradd -m -g default default
ENV HOME=/home/default
USER default
